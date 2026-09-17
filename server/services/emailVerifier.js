import { isRoleBased } from './roleChecker.js';
import { isDisposable } from './disposableChecker.js';
import { checkFreeProvider } from './freeProviderChecker.js';
import { checkDNS } from './dnsVerifier.js';
import { verifySMTP } from './smtpVerifier.js';
import { verifyM365 } from './m365Verifier.js';
import { calculateScoreAndStatus } from './riskScorer.js';

// RFC 5322-compliant syntax check
// - Rejects consecutive dots
// - Requires TLD of at least 2 characters
// - Rejects leading/trailing dots in local part
const emailRegex = /^(?!.*\.\.)[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

// Per-domain catch-all cache to avoid redundant probes
const catchAllCache = new Map();
const DNS_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export async function verifyEmail(originalEmail, options = {}) {
  const mode = options.mode || 'STANDARD'; // FAST, STANDARD, DEEP
  const normalizedEmail = originalEmail.trim().toLowerCase();

  let syntaxValid = emailRegex.test(normalizedEmail);
  const parts = normalizedEmail.split('@');
  const domain = parts.length === 2 ? parts[1] : '';

  const result = {
    email: originalEmail,
    normalizedEmail,
    domain,
    syntaxValid,
    domainValid: false,
    mxValid: false,
    mxHost: null,
    disposable: false,
    roleBased: false,
    freeProvider: false,
    provider: null,
    catchAll: false,
    smtpChecked: false,
    smtpStatus: null,
    smtpCode: null,
    smtpMessage: null,
    status: 'UNKNOWN',
    confidenceScore: 0,
    riskReasons: []
  };

  if (!syntaxValid || !domain) {
    const final = calculateScoreAndStatus(result);
    return { ...result, ...final, riskReasons: final.reasons.join(', ') };
  }

  // 1. FAST Checks — these are all synchronous/cheap
  result.roleBased = isRoleBased(normalizedEmail);
  result.disposable = isDisposable(domain);

  const providerInfo = checkFreeProvider(domain);
  result.freeProvider = providerInfo.freeProvider;
  result.provider = providerInfo.provider;

  // 2. DNS Check
  const dnsResult = await checkDNS(domain);
  result.domainValid = dnsResult.domainValid;
  result.mxValid = dnsResult.mxValid;
  result.mxHost = dnsResult.mxHost;

  // Exit early if FAST mode or no valid MX records found
  if (mode === 'FAST' || !result.mxValid || !result.mxHost) {
    const final = calculateScoreAndStatus(result);
    return { ...result, ...final, riskReasons: final.reasons.join(', ') };
  }

  // 3. Custom API Bypasses for specific hosts (Reacherhq logic)
  const isM365 = result.mxHost.includes('mail.protection.outlook.com');

  if (isM365) {
    const m365Result = await verifyM365(normalizedEmail);
    // If the OneDrive API confirms it exists (403), we can skip SMTP entirely!
    if (m365Result.isDeliverable) {
      Object.assign(result, m365Result);
      result.catchAll = false; // Handled strictly via API
      const final = calculateScoreAndStatus(result);
      return { ...result, ...final, riskReasons: final.reasons.join(', ') };
    }
    // If it returns false (e.g. 404 because it's a shared mailbox), we fall back to SMTP.
  }

  // 3. STANDARD / DEEP Checks — run catch-all detection + real SMTP in parallel
  const smtpTimeout = options.smtpTimeout || 15000;

  // Catch-all probe: send to a random address to test if server accepts everything
  const getCatchAll = async () => {
    if (catchAllCache.has(domain)) {
      return catchAllCache.get(domain);
    }
    const randomLocal = `probe-${Math.random().toString(36).substring(2, 12)}-${Date.now()}`;
    const dummyEmail = `${randomLocal}@${domain}`;
    try {
      const probeResult = await verifySMTP(dummyEmail, result.mxHost, { timeout: smtpTimeout });
      const isCatchAll = probeResult.smtpStatus === '2xx';
      // Cache with TTL
      catchAllCache.set(domain, isCatchAll);
      setTimeout(() => catchAllCache.delete(domain), DNS_CACHE_TTL_MS);
      return isCatchAll;
    } catch (e) {
      return false;
    }
  };

  // Run catch-all probe and real SMTP verification IN PARALLEL to halve total time
  const [catchAll, smtpResult] = await Promise.all([
    getCatchAll(),
    verifySMTP(normalizedEmail, result.mxHost, { timeout: smtpTimeout })
  ]);

  result.catchAll = catchAll;
  result.smtpChecked = smtpResult.smtpChecked;
  result.smtpStatus = smtpResult.smtpStatus;
  result.smtpCode = smtpResult.smtpCode;
  result.smtpMessage = smtpResult.smtpMessage;

  const final = calculateScoreAndStatus(result);
  return { ...result, ...final, riskReasons: final.reasons.join(', ') };
}
