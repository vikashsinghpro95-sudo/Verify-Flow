export function calculateScoreAndStatus(result) {
  let score = 0;
  const reasons = [];
  let status = 'UNKNOWN'; // DELIVERABLE, RISKY, UNDELIVERABLE, UNKNOWN

  // 1. Hard Rejections
  if (!result.syntaxValid) {
    return { score: 0, status: 'UNDELIVERABLE', reasons: ['Invalid Syntax'] };
  }
  score += 20;

  if (!result.domainValid || !result.mxValid) {
    return { score: 0, status: 'UNDELIVERABLE', reasons: ['Domain or MX Invalid'] };
  }
  score += 20;

  if (result.smtpStatus === '5xx') {
    const msg = (result.smtpMessage || '').toLowerCase();
    const isIpBlock = msg.includes('spamhaus') || msg.includes('blocked') || 
                      msg.includes('banned') || msg.includes('blacklisted') ||
                      msg.includes('client host rejected') || msg.includes('service unavailable') ||
                      msg.includes('access denied') || msg.includes('rate limited') ||
                      msg.includes('too many connections') || msg.includes('spam');
    
    if (isIpBlock) {
       // We couldn't verify because our IP/server is blocked, not because the email is invalid.
       // So we score it as UNKNOWN (or RISKY), but definitely not UNDELIVERABLE.
       score += 20; // Domain was valid
       reasons.push(`Provider blocked verification: ${result.smtpMessage}`);
       result.smtpStatus = 'BLOCKED'; // Change status so it falls into UNKNOWN logic
    } else {
       return { score: 0, status: 'UNDELIVERABLE', reasons: [`SMTP Permanent Rejection: ${result.smtpMessage}`] };
    }
  }
  // 2. Add points for positive signals
  if (result.mxValid) score += 20;
  if (result.smtpStatus === '2xx') score += 30;

  // 3. Deduct points and mark RISKY for negative signals
  let isRisky = false;

  if (result.disposable) {
    score -= 30;
    isRisky = true;
    reasons.push('Disposable Email');
  }

  if (result.catchAll) {
    score -= 20;
    isRisky = true;
    reasons.push('Catch-All Domain');
  }

  if (result.roleBased) {
    score -= 10;
    isRisky = true;
    reasons.push('Role-Based Account');
  }

  if (result.smtpStatus === '4xx') {
    score -= 20;
    reasons.push(`SMTP Temporary Failure: ${result.smtpMessage}`);
    // If we only have temporary failure and no other proof, it's UNKNOWN
  } else if (result.smtpStatus === 'TIMEOUT' || result.smtpStatus === 'ERROR') {
    reasons.push(`SMTP check failed: ${result.smtpMessage}`);
  }

  // Determine final status
  if (score < 0) score = 0;
  if (score > 100) score = 100;

  if (result.smtpStatus === '2xx' && !isRisky) {
    status = 'DELIVERABLE';
    // Base 90 for 2xx, up to 100 if no risk signals
    score = Math.max(score, 90);
  } else if (isRisky && result.smtpStatus !== '5xx') {
    status = 'RISKY';
  } else if (result.smtpStatus === '4xx' || result.smtpStatus === 'TIMEOUT' || result.smtpStatus === 'ERROR' || result.smtpStatus === 'BLOCKED') {
    status = 'UNKNOWN';
  } else if (score >= 60) {
     status = 'RISKY'; // E.g., no SMTP check run, but domain is valid and not disposable
  }

  return { score, status, reasons };
}
