import { isSoftRoleBased } from './roleChecker.js';

/**
 * Statuses:
 *   DELIVERABLE      - SMTP confirmed 2xx, not catch-all. Safest to send.
 *   RISKY            - Cannot fully verify but email likely exists. Send with caution.
 *   UNDELIVERABLE    - Confirmed bad: invalid syntax, dead domain, no MX, disposable, strict role (noreply etc), 5xx user unknown.
 *
 * RISKY sub-reasons (shown in UI):
 *   - Catch-All Domain       (server accepts everything, can't verify mailbox)
 *   - Role-Based Address     (corporate dept emails: info@, support@, investor@)
 *   - IP Reputation Block    (our IP is on Spamhaus; email MAY be valid)
 *   - SMTP Timeout           (server didn't respond; could be firewall)
 *   - Connection Failed      (network error reaching server)
 *   - Greylisting Detected   (4xx temporary block; retry suggested)
 */
function _calculateScoreAndStatus(result) {
  const reasons = [];
  let verification_level = 'UNVERIFIED';
  let provider_blocked = false;

  // ─── HARD FAILURES (always UNDELIVERABLE) ────────────────────────────────

  if (!result.syntaxValid) {
    return { score: 0, status: 'UNDELIVERABLE', verification_level, provider_blocked, reasons: ['Invalid Syntax'] };
  }

  if (!result.domainValid) {
    return { score: 0, status: 'UNDELIVERABLE', verification_level, provider_blocked, reasons: ['DOMAIN_NOT_FOUND'] };
  }

  if (!result.mxValid) {
    return { score: 0, status: 'UNDELIVERABLE', verification_level, provider_blocked, reasons: ['NO_MX_RECORD'] };
  }

  if (result.disposable) {
    return { score: 0, status: 'UNDELIVERABLE', verification_level, provider_blocked, reasons: ['Disposable Email'] };
  }

  // ─── SMTP 5xx: determine if it's a user-rejection or an IP block ─────────
  if (result.smtpStatus === '5xx') {
    const msg = (result.smtpMessage || '').toLowerCase();

    const isIpBlock =
      msg.includes('spamhaus') || msg.includes('client host') ||
      msg.includes('blocked') || msg.includes('banned') ||
      msg.includes('blacklisted') || msg.includes('access denied') ||
      msg.includes('service unavailable') || msg.includes('reputation') ||
      msg.includes('policy') || msg.includes('dynamic ip') ||
      msg.includes('dnsbl') || msg.includes('rbl') ||
      msg.includes('barracuda') || msg.includes('dul') ||
      msg.includes('ers-dul') || msg.includes('spf') ||
      msg.includes('rate limit') || msg.includes('too many');

    const isUserUnknown =
      msg.includes('user unknown') || msg.includes('no such user') ||
      msg.includes('mailbox not found') || msg.includes('invalid-recipient') ||
      msg.includes('does not exist') || msg.includes('address rejected') ||
      msg.includes('no mailbox') || msg.includes('recipient rejected') ||
      (msg.includes('5.1.1') && !isIpBlock);

    if (isIpBlock) {
      provider_blocked = true;
      // IP block does NOT mean email is invalid — it means our IP is blacklisted
      // Classify as RISKY so users can still try sending via a clean SMTP service
      const softRole = result.roleBased ? false : isSoftRoleBased(result.email || result.normalizedEmail || '');
      reasons.push('IP Reputation Block (Blacklisted IP — Email May Exist)');
      if (result.catchAll) reasons.push('Catch-All Domain');
      if (result.roleBased || softRole) reasons.push('Role-Based Address');
      return { score: 35, status: 'RISKY', verification_level: 'IP_BLOCKED', provider_blocked, reasons };
    }

    if (isUserUnknown) {
      return { score: 0, status: 'UNDELIVERABLE', verification_level, provider_blocked, reasons: [`Mailbox Does Not Exist (${result.smtpCode})`] };
    }

    // Unknown 5xx — treat as risky rather than hard-fail
    return { score: 20, status: 'RISKY', verification_level: 'SMTP_ERROR', provider_blocked, reasons: [`SMTP Error: ${result.smtpMessage}`] };
  }

  // ─── CONFIRMED DELIVERABLE ────────────────────────────────────────────────
  if (result.smtpStatus === '2xx') {
    if (result.catchAll) {
      // Even a 2xx on a catch-all is unreliable
      verification_level = 'CATCH_ALL';
      return { score: 55, status: 'RISKY', verification_level, provider_blocked, reasons: ['Catch-All Domain (Accepted But Unverifiable)'] };
    }
    verification_level = 'CONFIRMED';
    const score = Math.floor(Math.random() * 11) + 90; // 90–100
    const softRole = isSoftRoleBased(result.email || result.normalizedEmail || '');
    if (result.roleBased || softRole) {
      reasons.push('Role-Based Address (Confirmed Active)');
      return { score: 75, status: 'DELIVERABLE', verification_level: 'CONFIRMED_ROLE', provider_blocked, reasons };
    }
    return { score, status: 'DELIVERABLE', verification_level, provider_blocked, reasons: ['Confirmed Mailbox'] };
  }

  // ─── UNCONFIRMED / TEMPORARY ISSUES → RISKY ──────────────────────────────

  if (result.catchAll) {
    verification_level = 'CATCH_ALL';
    const softRole = isSoftRoleBased(result.email || result.normalizedEmail || '');
    reasons.push('Catch-All Domain (Cannot Verify Individual Mailbox)');
    if (result.roleBased || softRole) reasons.push('Role-Based Address');
    return { score: 40, status: 'RISKY', verification_level, provider_blocked, reasons };
  }

  const softRole = isSoftRoleBased(result.email || result.normalizedEmail || '');
  if (result.roleBased) {
    // Hard role-based (noreply, daemon) — UNDELIVERABLE
    return { score: 0, status: 'UNDELIVERABLE', verification_level, provider_blocked, reasons: ['System/Bounce Address (No-Reply)'] };
  }

  if (softRole) {
    // Soft role (info@, support@, investor@) without SMTP confirmation = RISKY
    reasons.push('Role-Based Address (Departmental — Unconfirmed)');
    let score = 45;
    if (result.smtpStatus === '4xx') { reasons.push('Greylisting Detected'); score = 40; }
    else if (result.smtpStatus === 'TIMEOUT') { reasons.push('SMTP Timeout'); score = 35; }
    else if (result.smtpStatus === 'ERROR') { reasons.push('Connection Failed'); score = 30; }
    return { score, status: 'RISKY', verification_level: 'SOFT_ROLE', provider_blocked, reasons };
  }

  // Non-role addresses with network issues
  if (result.smtpStatus === '4xx') {
    return { score: 45, status: 'RISKY', verification_level: 'GREYLISTED', provider_blocked, reasons: ['Greylisting Detected (Temporary Block — Likely Valid)'] };
  }
  if (result.smtpStatus === 'TIMEOUT') {
    return { score: 40, status: 'RISKY', verification_level: 'TIMEOUT', provider_blocked, reasons: ['SMTP Timeout (Server Unresponsive — May Be Filtered)'] };
  }
  if (result.smtpStatus === 'ERROR') {
    return { score: 35, status: 'RISKY', verification_level: 'ERROR', provider_blocked, reasons: ['Connection Failed (Network Error)'] };
  }

  return { score: 30, status: 'RISKY', verification_level, provider_blocked, reasons: ['Unconfirmed (No SMTP Response)'] };
}

export function calculateScoreAndStatus(result) {
  return _calculateScoreAndStatus(result);
}
