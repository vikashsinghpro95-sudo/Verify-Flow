// Common role-based email prefixes
// Only the most generic/abusive ones — specific departmental contacts are VALID
const rolePrefixes = [
  'noreply', 'no-reply', 'donotreply', 'do-not-reply',
  'bounce', 'daemon', 'mailer', 'postmaster', 'abuse',
  'root', 'spam', 'alerts', 'notifications', 'notification',
  'newsletter', 'mailer-daemon', 'autoresponder'
];

// Softer role-based prefixes — these are risky but still commonly deliverable
// We will NOT reject these outright, just flag them as RISKY
export const softRolePrefixes = [
  'admin', 'administrator', 'info', 'support', 'sales', 'contact',
  'hello', 'help', 'billing', 'marketing', 'hr', 'careers',
  'office', 'webmaster', 'security', 'sysadmin', 'it',
  'enquiries', 'enquiry', 'service', 'services', 'ops', 'operations',
  'accounts', 'accounting', 'finance', 'legal', 'press', 'media',
  'team', 'jobs', 'recruitment', 'pr', 'social', 'feedback',
  'reply', 'care', 'customercare', 'cs', 'tech', 'helpdesk',
  'desk', 'reception', 'corphqo', 'infodesk', 'query', 'contactus',
  'igrc', 'ho', 'customer', 'corporate', 'investor',
  'investorrelations', 'investorrelation', 'shares', 'company'
];

export function isRoleBased(email) {
  const localPart = email.split('@')[0].toLowerCase()
    .replace(/[._\-+]/g, '');

  // Strict role = definitely bounce-risk (e.g. noreply, daemon)
  const isStrict = rolePrefixes.some(prefix => {
    const normalizedPrefix = prefix.replace(/[._\-+]/g, '');
    return localPart === normalizedPrefix || localPart.startsWith(normalizedPrefix);
  });

  return isStrict;
}

export function isSoftRoleBased(email) {
  const localPart = email.split('@')[0].toLowerCase()
    .replace(/[._\-+]/g, '');

  return softRolePrefixes.some(prefix => {
    const normalizedPrefix = prefix.replace(/[._\-+]/g, '');
    return localPart === normalizedPrefix || localPart.startsWith(normalizedPrefix);
  });
}
