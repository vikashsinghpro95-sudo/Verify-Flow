import { verifyEmail } from './services/emailVerifier.js';

async function runTests() {
  const emails = [
    'test@yahoo.com',          // Expected: Deliverable / Valid
    'not_exist_12349098@yahoo.com', // Expected: Undeliverable / Valid syntax
    'info@microsoft.com',      // Expected to use M365 logic
  ];

  for (const email of emails) {
    console.log(`\nTesting: ${email}`);
    try {
      const result = await verifyEmail(email);
      console.log(`Result: ${result.status} (Score: ${result.confidenceScore})`);
      console.log(`Reasons: ${result.riskReasons}`);
      console.log(`SMTP Status: ${result.smtpStatus}, Code: ${result.smtpCode}, Message: ${result.smtpMessage}`);
    } catch (e) {
      console.error('Error:', e.message);
    }
  }
}

runTests();
