import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Load the comprehensive community-maintained list of 40,000+ disposable domains
const disposableDomains = require('disposable-email-domains');

// Convert to a Set for O(1) lookup
const disposableSet = new Set(disposableDomains);

// Additional domains not in the main list
const extraDisposable = new Set([
  'tempinbox.com', 'fakeinbox.com', 'temp-mail.org', 'throwam.com',
  'spamgourmet.com', 'mailnull.com', 'spambox.us', 'discard.email',
  'spamoff.de', 'filzmail.com', 'wegwerfmail.de', 'spamfree24.org',
  'mailexpire.com', 'spamex.com', 'gishpuppy.com', 'mailnesia.com',
  'binkmail.com', 'bobmail.info', 'clrmail.com', 'dayrep.com',
  'dispostable.com', 'einrot.com', 'fantasymail.de', 'fleckens.hu'
]);

export function isDisposable(domain) {
  const d = domain.toLowerCase();
  return disposableSet.has(d) || extraDisposable.has(d);
}
