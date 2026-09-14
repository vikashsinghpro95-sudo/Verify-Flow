function _calculateScoreAndStatus(result) {
  const reasons = [];
  let verification_level = 'UNVERIFIED';
  let provider_blocked = false;

  // ─── HYPER-STRICT FAILURES (To guarantee lowest possible bounce rate) ──────

  // 1. Invalid syntax
  if (!result.syntaxValid) {
    return { score: 0, status: 'UNDELIVERABLE', verification_level, provider_blocked, reasons: ['Invalid Syntax'] };
  }

  // 2. Domain doesn't exist (DNS lookup failed with NXDOMAIN)
  if (!result.domainValid) {
    return { score: 0, status: 'UNDELIVERABLE', verification_level, provider_blocked, reasons: ['DOMAIN_NOT_FOUND'] };
  }

  // 3. No valid MX records
  if (!result.mxValid) {
    return { score: 0, status: 'UNDELIVERABLE', verification_level, provider_blocked, reasons: ['NO_MX_RECORD'] };
  }

  // 4. Disposable/throwaway email service
  if (result.disposable) {
    return { score: 0, status: 'UNDELIVERABLE', verification_level, provider_blocked, reasons: ['Disposable Email'] };
  }

  // 5. Catch-All Domain
  // If the server accepts ANY random email, it's lying to us.
  // We cannot guarantee the real mailbox exists, and they often bounce later (e.g., Yahoo, AOL, Corporate Catch-Alls).
  if (result.catchAll) {
    return { score: 0, status: 'UNDELIVERABLE', verification_level, provider_blocked, reasons: ['Catch-All Domain (Unverifiable / High Bounce Risk)'] };
  }

  // 6. Role-Based Account
  // Emails like sales@, info@ often bounce or hit spam traps.
  if (result.roleBased) {
    return { score: 0, status: 'UNDELIVERABLE', verification_level, provider_blocked, reasons: ['Role-Based Account (High Bounce Risk)'] };
  }

  // ─── SMTP RESPONSE ANALYSIS ────────────────────────────────────────────────

  if (result.smtpStatus === '5xx') {
    const msg = (result.smtpMessage || '').toLowerCase();
    
    // Check if the block was IP based (for UI logging)
    const isIpBlock =
      msg.includes('spamhaus') || msg.includes('client host') ||
      msg.includes('blocked') || msg.includes('banned') ||
      msg.includes('blacklisted') || msg.includes('access denied') ||
      msg.includes('service unavailable') || msg.includes('rate limit') ||
      msg.includes('too many connections') || msg.includes('policy') ||
      msg.includes('reputation');
      
    if (isIpBlock) provider_blocked = true;

    // Any 5xx in hyper-strict mode is an immediate failure
    return {
      score: 0,
      status: 'UNDELIVERABLE',
      verification_level,
      provider_blocked,
      reasons: [`SMTP Rejected: ${result.smtpMessage}`]
    };
  }

  // ─── PRISTINE CONFIRMED DELIVERABLE ────────────────────────────────────────
  // The server returned a 2xx for this exact mailbox, AND the domain is NOT a catch-all.
  // This is the highest possible guarantee of delivery.
  if (result.smtpStatus === '2xx') {
    verification_level = 'CONFIRMED';
    const score = Math.floor(Math.random() * 11) + 90; // 90–100
    return { score, status: 'DELIVERABLE', verification_level, provider_blocked, reasons: ['Confirmed Mailbox'] };
  }

  // ─── UNCONFIRMED / NEUTRAL ─────────────────────────────────────────────────
  // 4xx greylisting, timeouts, unreachables.
  // We cannot guarantee they exist, so in Hyper-Strict mode, they MUST be rejected.
  let reason = 'UNCONFIRMED_REJECTED';
  if (result.smtpStatus === '4xx') reason = 'Server Greylisting (Unconfirmed)';
  else if (result.smtpStatus === 'TIMEOUT') reason = 'SMTP Timeout (Unconfirmed)';
  else if (result.smtpStatus === 'ERROR') reason = 'Connection Failed (Unconfirmed)';
  else if (!result.smtpChecked) reason = 'No SMTP Check Ran (Unconfirmed)';

  return {
    score: 0,
    status: 'UNDELIVERABLE',
    verification_level,
    provider_blocked,
    reasons: [reason]
  };
}

export function calculateScoreAndStatus(result) {
  return _calculateScoreAndStatus(result);
}
