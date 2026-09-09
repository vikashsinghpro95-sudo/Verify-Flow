import { verifySMTP } from './server/services/smtpVerifier.js';
import { checkDNS } from './server/services/dnsVerifier.js';

async function run() {
  const domain = 'mpsindia.in';
  const email = 'Sales@mpsindia.in';
  const dnsRes = await checkDNS(domain);
  console.log('DNS:', dnsRes);
  if (dnsRes.mxHost) {
    const res = await verifySMTP(email, dnsRes.mxHost);
    console.log('SMTP:', res);
  }
}
run();
