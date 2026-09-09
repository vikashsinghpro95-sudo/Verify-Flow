import { verifySMTP } from './server/services/smtpVerifier.js';
import { checkDNS } from './server/services/dnsVerifier.js';

async function run() {
  const domain = 'vpagroup.in';
  const dnsRes = await checkDNS(domain);
  console.log('DNS:', dnsRes);
  if (dnsRes.mxHost) {
    const res = await verifySMTP(`random12312389123890123@${domain}`, dnsRes.mxHost);
    console.log('Random SMTP:', res);
  }
}
run();
