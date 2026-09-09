const freeProviders = {
  'gmail.com': 'Google',
  'yahoo.com': 'Yahoo',
  'hotmail.com': 'Microsoft',
  'outlook.com': 'Microsoft',
  'live.com': 'Microsoft',
  'icloud.com': 'Apple',
  'aol.com': 'AOL',
  'protonmail.com': 'Proton',
  'zoho.com': 'Zoho',
  'yandex.com': 'Yandex',
  'mail.com': 'Mail.com'
};

export function checkFreeProvider(domain) {
  const d = domain.toLowerCase();
  if (freeProviders[d]) {
    return { freeProvider: true, provider: freeProviders[d] };
  }
  return { freeProvider: false, provider: null };
}
