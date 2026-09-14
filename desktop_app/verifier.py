import re
import socket
import smtplib
import dns.resolver
import random
import time

# --- Static Lists ---
ROLE_PREFIXES = {
    'admin', 'administrator', 'info', 'support', 'sales', 'contact',
    'hello', 'help', 'billing', 'marketing', 'hr', 'careers',
    'office', 'noreply', 'no-reply', 'postmaster', 'webmaster',
    'abuse', 'hostmaster', 'security', 'sysadmin', 'it'
}

DISPOSABLE_DOMAINS = {
    'tempmail.com', 'throwawaymail.com', '10minutemail.com', 'mailinator.com',
    'guerrillamail.com', 'yopmail.com', 'trashmail.com', 'dispostable.com',
    'sharklasers.com', 'grr.la', 'anonbox.net', 'maildrop.cc'
}

FREE_PROVIDERS = {
    'gmail.com': 'Google',
    'yahoo.com': 'Yahoo',
    'hotmail.com': 'Microsoft',
    'outlook.com': 'Microsoft',
    'live.com': 'Microsoft',
    'icloud.com': 'Apple',
    'aol.com': 'AOL',
    'protonmail.com': 'Proton',
    'zoho.com': 'Zoho',
    'yandex.com': 'Yandex',
    'mail.com': 'Mail.com'
}

EMAIL_REGEX = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

# --- Globals ---
DNS_CACHE = {}
CATCH_ALL_CACHE = {}


def check_syntax(email):
    return bool(EMAIL_REGEX.match(email))


def check_dns(domain):
    if domain in DNS_CACHE:
        return DNS_CACHE[domain]

    result = {'valid': False, 'mxHost': None, 'error': None}
    try:
        answers = dns.resolver.resolve(domain, 'MX')
        records = sorted(answers, key=lambda x: x.preference)
        if records:
            result['valid'] = True
            result['mxHost'] = str(records[0].exchange).rstrip('.')
    except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN):
        # Fallback to A record
        try:
            dns.resolver.resolve(domain, 'A')
            result['valid'] = True
            result['mxHost'] = domain
        except Exception:
            result['error'] = 'DOMAIN_NOT_FOUND'
    except Exception as e:
        result['error'] = 'DNS_ERROR'

    DNS_CACHE[domain] = result
    return result


def verify_smtp(email, mx_host, timeout=10):
    result = {
        'smtpChecked': True,
        'smtpStatus': 'ERROR',
        'smtpCode': None,
        'smtpMessage': None
    }
    
    sender_domain = 'example.com'
    sender_address = f'verify@{sender_domain}'

    try:
        server = smtplib.SMTP(timeout=timeout)
        code, msg = server.connect(mx_host, 25)
        
        if code >= 400:
            result['smtpStatus'] = '4xx' if code < 500 else '5xx'
            result['smtpCode'] = code
            result['smtpMessage'] = msg.decode('utf-8', 'ignore') if isinstance(msg, bytes) else msg
            return result

        server.helo(sender_domain)
        server.mail(sender_address)
        code, msg = server.rcpt(email)
        
        msg_str = msg.decode('utf-8', 'ignore') if isinstance(msg, bytes) else str(msg)
        result['smtpCode'] = code
        result['smtpMessage'] = msg_str

        if 200 <= code < 300:
            result['smtpStatus'] = '2xx'
        elif 400 <= code < 500:
            result['smtpStatus'] = '4xx'
        else:
            result['smtpStatus'] = '5xx'
            
        # Detect IP blocks in 5xx
        if result['smtpStatus'] == '5xx':
            msg_lower = msg_str.lower()
            if any(k in msg_lower for k in ['spamhaus', 'blocked', 'banned', 'blacklisted', 'client host rejected', 'service unavailable']):
                result['smtpStatus'] = 'BLOCKED'

        server.quit()
    except socket.timeout:
        result['smtpStatus'] = 'TIMEOUT'
        result['smtpMessage'] = 'Connection timed out'
    except Exception as e:
        result['smtpStatus'] = 'ERROR'
        result['smtpMessage'] = str(e)
        
    return result


def calculate_score_and_status(res):
    score = 0
    reasons = []
    status = 'UNKNOWN'

    if not res['syntaxValid']:
        return 0, 'UNDELIVERABLE', ['Invalid Syntax']
    score += 20

    if not res['domainValid'] or not res['mxValid']:
        return 0, 'UNDELIVERABLE', ['Domain or MX Invalid']
    score += 20

    if res['smtpStatus'] == '5xx':
        return 0, 'UNDELIVERABLE', [f"SMTP Permanent Rejection: {res['smtpMessage']}"]
    
    if res['smtpStatus'] == 'BLOCKED':
        score += 20
        reasons.append(f"Provider blocked verification: {res['smtpMessage']}")
        
    if res['mxValid']: score += 20
    if res['smtpStatus'] == '2xx': score += 30

    is_risky = False
    if res['disposable']:
        score -= 30
        is_risky = True
        reasons.append('Disposable Email')

    if res['catchAll']:
        score -= 20
        is_risky = True
        reasons.append('Catch-All Domain')

    if res['roleBased']:
        score -= 10
        is_risky = True
        reasons.append('Role-Based Account')

    if res['smtpStatus'] == '4xx':
        score -= 20
        reasons.append(f"SMTP Temporary Failure: {res['smtpMessage']}")
    elif res['smtpStatus'] in ('TIMEOUT', 'ERROR'):
        reasons.append(f"SMTP check failed: {res['smtpMessage']}")

    score = max(0, min(100, score))

    if res['smtpStatus'] == '2xx' and not is_risky:
        status = 'DELIVERABLE'
        score = max(score, 90)
    elif is_risky and res['smtpStatus'] not in ('5xx', 'UNDELIVERABLE'):
        status = 'RISKY'
    elif res['smtpStatus'] in ('4xx', 'TIMEOUT', 'ERROR', 'BLOCKED'):
        status = 'UNKNOWN'
    elif score >= 60:
        status = 'RISKY'

    return score, status, reasons


def verify_email_address(original_email, timeout=10):
    normalized_email = original_email.strip().lower()
    syntax_valid = check_syntax(normalized_email)
    
    domain = normalized_email.split('@')[1] if '@' in normalized_email else ''
    
    res = {
        'original_email': original_email,
        'normalized_email': normalized_email,
        'domain': domain,
        'syntaxValid': syntax_valid,
        'domainValid': False,
        'mxValid': False,
        'mxHost': None,
        'disposable': False,
        'roleBased': False,
        'freeProvider': False,
        'provider': None,
        'catchAll': False,
        'smtpChecked': False,
        'smtpStatus': None,
        'smtpCode': None,
        'smtpMessage': None
    }

    if not syntax_valid or not domain:
        score, status, reasons = calculate_score_and_status(res)
        return {**res, 'score': score, 'status': status, 'reasons': ', '.join(reasons)}

    # Fast Checks
    local_part = normalized_email.split('@')[0]
    res['roleBased'] = local_part in ROLE_PREFIXES
    res['disposable'] = domain in DISPOSABLE_DOMAINS
    res['freeProvider'] = domain in FREE_PROVIDERS
    if res['freeProvider']:
        res['provider'] = FREE_PROVIDERS[domain]

    # DNS
    dns_res = check_dns(domain)
    res['domainValid'] = dns_res['valid']
    res['mxValid'] = dns_res['valid']
    res['mxHost'] = dns_res.get('mxHost')

    if res['mxValid'] and res['mxHost']:
        # Catch All Check
        if domain not in CATCH_ALL_CACHE:
            rand_str = ''.join(random.choices('abcdefghijklmnopqrstuvwxyz0123456789', k=10))
            dummy = f"test-{rand_str}@{domain}"
            catch_all_res = verify_smtp(dummy, res['mxHost'], timeout)
            CATCH_ALL_CACHE[domain] = (catch_all_res['smtpStatus'] == '2xx')
            
        res['catchAll'] = CATCH_ALL_CACHE[domain]

        # Standard SMTP Check
        smtp_res = verify_smtp(normalized_email, res['mxHost'], timeout)
        res['smtpChecked'] = smtp_res['smtpChecked']
        res['smtpStatus'] = smtp_res['smtpStatus']
        res['smtpCode'] = smtp_res['smtpCode']
        res['smtpMessage'] = smtp_res['smtpMessage']

    score, status, reasons = calculate_score_and_status(res)
    return {**res, 'score': score, 'status': status, 'reasons': ', '.join(reasons)}
