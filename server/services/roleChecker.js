const rolePrefixes = new Set([
  'admin', 'administrator', 'info', 'support', 'sales', 'contact',
  'hello', 'help', 'billing', 'marketing', 'hr', 'careers',
  'office', 'noreply', 'no-reply', 'postmaster', 'webmaster',
  'abuse', 'hostmaster', 'security', 'sysadmin', 'it'
]);

export function isRoleBased(email) {
  const localPart = email.split('@')[0].toLowerCase();
  return rolePrefixes.has(localPart);
}
