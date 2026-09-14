// Common role-based email prefixes
// Using prefix matching so "sales1", "admin.team", "hr.support" etc. are also caught
const rolePrefixes = [
  'admin', 'administrator', 'info', 'support', 'sales', 'contact',
  'hello', 'help', 'billing', 'marketing', 'hr', 'careers',
  'office', 'noreply', 'no-reply', 'postmaster', 'webmaster',
  'abuse', 'hostmaster', 'security', 'sysadmin', 'it',
  'newsletter', 'mail', 'mailer', 'daemon', 'root', 'spam',
  'enquiries', 'enquiry', 'service', 'services', 'ops', 'operations',
  'accounts', 'accounting', 'finance', 'legal', 'press', 'media',
  'team', 'jobs', 'recruitment', 'pr', 'social', 'feedback',
  'reply', 'bounce', 'donotreply', 'do-not-reply', 'alerts',
  'notifications', 'notification', 'care', 'customercare', 'cs',
  'tech', 'helpdesk', 'desk', 'reception'
];

export function isRoleBased(email) {
  const localPart = email.split('@')[0].toLowerCase()
    // Strip common separators to normalize: sales.team → salesteam
    .replace(/[._\-+]/g, '');

  return rolePrefixes.some(prefix => {
    const normalizedPrefix = prefix.replace(/[._\-+]/g, '');
    return localPart === normalizedPrefix || localPart.startsWith(normalizedPrefix);
  });
}
