import { verifySMTP } from './server/services/smtpVerifier.js';
import { checkDNS } from './server/services/dnsVerifier.js';

async function testDomain(domain, specificEmail) {
  console.log(`\n--- Testing ${domain} ---`);
  const dnsRes = await checkDNS(domain);
  console.log('MX Host:', dnsRes.mxHost);
  if (dnsRes.mxHost) {
    const resSpecific = await verifySMTP(specificEmail, dnsRes.mxHost);
    console.log(`Target Email (${specificEmail}):`, resSpecific);

    const dummyEmail = `test-${Math.random().toString(36).substring(2, 15)}@${domain}`;
    const resDummy = await verifySMTP(dummyEmail, dnsRes.mxHost);
    console.log(`Dummy Email (${dummyEmail}):`, resDummy);
  }
}

async function run() {
  await testDomain('vilindia.com', 'emailritesh.dahikar@vilindia.com');
  await testDomain('smpolymers.com', 'email-sales@smpolymers.com');
}

run();
