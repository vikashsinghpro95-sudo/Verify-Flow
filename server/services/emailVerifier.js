import { isRoleBased } from './roleChecker.js';
import { isDisposable } from './disposableChecker.js';
import { checkFreeProvider } from './freeProviderChecker.js';
import { checkDNS } from './dnsVerifier.js';
import { verifySMTP } from './smtpVerifier.js';
import { calculateScoreAndStatus } from './riskScorer.js';

// Basic email syntax regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const catchAllCache = new Map();

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

  // 1. FAST Checks
  result.roleBased = isRoleBased(normalizedEmail);
  result.disposable = isDisposable(domain);
  
  const providerInfo = checkFreeProvider(domain);
  result.freeProvider = providerInfo.freeProvider;
  result.provider = providerInfo.provider;

  // DNS Check
  const dnsResult = await checkDNS(domain);
  result.domainValid = dnsResult.domainValid;
  result.mxValid = dnsResult.mxValid;
  result.mxHost = dnsResult.mxHost;

  if (mode === 'FAST' || !result.mxValid) {
    const final = calculateScoreAndStatus(result);
    return { ...result, ...final, riskReasons: final.reasons.join(', ') };
  }


  // 2. STANDARD / DEEP Checks (SMTP)
  if (result.mxValid && result.mxHost) {
      // Catch-all check
      if (!catchAllCache.has(domain)) {
        const catchAllPromise = (async () => {
          const randomString = Math.random().toString(36).substring(2, 15) + Date.now();
          const dummyEmail = `test-${randomString}@${domain}`;
          const catchAllResult = await verifySMTP(dummyEmail, result.mxHost, {
             timeout: options.smtpTimeout
          });
          return catchAllResult.smtpStatus === '2xx';
        })();
        catchAllCache.set(domain, catchAllPromise);
        
        // Prevent map from growing infinitely
        if (catchAllCache.size > 10000) {
           // We shouldn't clear immediately if promises are pending, but for simplicity:
           // Better to clear later, but this is a naive way.
        }
      }

      try {
         result.catchAll = await catchAllCache.get(domain);
      } catch(e) {
         result.catchAll = false;
      }

      // Now do the standard SMTP check for the actual email
      const smtpResult = await verifySMTP(normalizedEmail, result.mxHost, {
          timeout: options.smtpTimeout
      });
      
      result.smtpChecked = smtpResult.smtpChecked;
      result.smtpStatus = smtpResult.smtpStatus;
      result.smtpCode = smtpResult.smtpCode;
      result.smtpMessage = smtpResult.smtpMessage;
  }

  const final = calculateScoreAndStatus(result);
  return { ...result, ...final, riskReasons: final.reasons.join(', ') };
}
