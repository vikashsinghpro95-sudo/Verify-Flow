import dns from 'dns';
const { resolveMx, resolve4 } = dns.promises;

const cache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export async function checkDNS(domain) {
  if (cache.has(domain)) {
    return cache.get(domain);
  }

  const result = {
    domainValid: false,
    mxValid: false,
    mxRecords: [],
    mxHost: null,
    error: null
  };

  try {
    const mxRecords = await resolveMx(domain);
    if (mxRecords && mxRecords.length > 0) {
      // Filter out null-MX records (RFC 7505: priority 0, exchange ".")
      const validMx = mxRecords.filter(r => r.exchange && r.exchange !== '.');
      
      if (validMx.length > 0) {
        result.domainValid = true;
        result.mxValid = true;
        // Sort by priority (lowest = highest priority)
        const sortedMx = validMx.sort((a, b) => a.priority - b.priority);
        result.mxRecords = sortedMx;
        result.mxHost = sortedMx[0].exchange;
      } else {
        // Domain exists but explicitly has null-MX (RFC 7505) — does not accept email
        result.domainValid = true;
        result.mxValid = false;
        result.error = 'NULL_MX';
      }
    }
  } catch (err) {
    if (err.code === 'ENODATA' || err.code === 'ENOTFOUND') {
      // No MX records — check if domain exists via A record
      // NOTE: we do NOT treat A-record fallback as mxValid=true
      // because most web servers block port 25 and will just time out
      try {
        const aRecords = await resolve4(domain);
        if (aRecords && aRecords.length > 0) {
          result.domainValid = true;
          result.mxValid = false; // Domain exists, but has no mail server
          result.error = 'NO_MX_RECORD';
        } else {
          result.error = 'DOMAIN_NOT_FOUND';
        }
      } catch (_) {
        result.error = 'DOMAIN_NOT_FOUND';
      }
    } else if (err.code === 'ETIMEOUT') {
      result.error = 'DNS_TIMEOUT';
    } else {
      result.error = 'DNS_ERROR';
    }
  }

  // Cache result with TTL
  cache.set(domain, result);
  setTimeout(() => cache.delete(domain), CACHE_TTL_MS);

  return result;
}
