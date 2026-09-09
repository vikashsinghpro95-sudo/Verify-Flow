import dns from 'dns';
const { resolveMx, resolve4, resolve6 } = dns.promises;

const cache = new Map();

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
      result.domainValid = true;
      result.mxValid = true;
      
      // Sort by priority (lowest number = highest priority)
      const sortedMx = mxRecords.sort((a, b) => a.priority - b.priority);
      result.mxRecords = sortedMx;
      result.mxHost = sortedMx[0].exchange;
    }
  } catch (err) {
    if (err.code === 'ENODATA' || err.code === 'ENOTFOUND') {
      // No MX records, fallback to A/AAAA
      try {
        const aRecords = await resolve4(domain);
        if (aRecords && aRecords.length > 0) {
          result.domainValid = true;
          // It's technically allowed to fall back to A record for SMTP
          result.mxValid = true; 
          result.mxHost = domain; // Use domain itself as host
        }
      } catch (fallbackErr) {
        // Try AAAA
        try {
            const aaaaRecords = await resolve6(domain);
            if (aaaaRecords && aaaaRecords.length > 0) {
              result.domainValid = true;
              result.mxValid = true;
              result.mxHost = domain;
            } else {
              result.error = 'DOMAIN_NOT_FOUND';
            }
        } catch (e) {
            result.error = 'DOMAIN_NOT_FOUND';
        }
      }
    } else {
      result.error = 'DNS_ERROR';
    }
  }

  cache.set(domain, result);
  // Clear cache periodically or keep it simple for now
  if(cache.size > 10000) cache.clear(); 
  
  return result;
}
