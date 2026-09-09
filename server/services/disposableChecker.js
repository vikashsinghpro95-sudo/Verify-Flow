const disposableDomains = new Set([
  'tempmail.com', 'throwawaymail.com', '10minutemail.com', 'mailinator.com',
  'guerrillamail.com', 'yopmail.com', 'trashmail.com', 'dispostable.com',
  'sharklasers.com', 'grr.la', 'anonbox.net', 'maildrop.cc'
  // Normally this list would be thousands of domains loaded from a DB or JSON
]);

export function isDisposable(domain) {
  return disposableDomains.has(domain.toLowerCase());
}
