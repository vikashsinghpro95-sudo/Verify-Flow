import axios from 'axios';

// Map of common Microsoft 365 domains to skip checking if they are not standard tenant domains, 
// though the tenant logic usually applies to custom corporate domains hosted on M365.
export async function verifyM365(email) {
  try {
    const [username, fullDomain] = email.trim().toLowerCase().split('@');
    if (!username || !fullDomain) throw new Error('Invalid email syntax');

    const domainParts = fullDomain.split('.');
    if (domainParts.length < 2) throw new Error('Invalid domain syntax');

    const tenant = domainParts[0]; // e.g., acmecomputercompany
    const sanitizedUsername = username.replace(/\./g, '_');
    const sanitizedDomain = fullDomain.replace(/\./g, '_');

    const url = `https://${tenant}-my.sharepoint.com/personal/${sanitizedUsername}_${sanitizedDomain}/_layouts/15/onedrive.aspx`;

    const response = await axios.head(url, {
      validateStatus: () => true, // Don't throw on 4xx/5xx
      timeout: 10000
    });

    const isDeliverable = response.status === 403;

    return {
      smtpChecked: true,
      smtpStatus: isDeliverable ? '2xx' : '5xx',
      smtpCode: isDeliverable ? 250 : 550,
      smtpMessage: `M365 OneDrive API: ${response.status}`,
      isDeliverable
    };

  } catch (error) {
    console.error(`M365 Verification Error for ${email}:`, error.message);
    return {
      smtpChecked: true,
      smtpStatus: 'ERROR',
      smtpCode: 0,
      smtpMessage: `M365 Bypass Failed: ${error.message}`,
      isDeliverable: false
    };
  }
}
