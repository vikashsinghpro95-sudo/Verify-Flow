import db from './database/database.js';
import { verifyEmail } from './services/emailVerifier.js';

async function processJob(jobId) {
  console.log('Processing job', jobId);
  const jobStmt = db.prepare('SELECT * FROM verification_jobs WHERE id = ? AND status = ?');
  const job = jobStmt.get(jobId, 'RUNNING');
  if (!job) {
     console.log('Job not RUNNING');
     return;
  }

  const emailsStmt = db.prepare(`
    SELECT e.id, e.original_email, e.normalized_email 
    FROM emails e
    LEFT JOIN verification_results r ON e.id = r.email_id
    WHERE e.job_id = ? AND r.id IS NULL
    LIMIT 50
  `);

  const emailsToProcess = emailsStmt.all(jobId);
  console.log('Emails to process:', emailsToProcess.length);

  if (emailsToProcess.length === 0) {
      console.log('No more emails.');
      return;
  }

  const concurrency = 5;
  const results = [];
  for (let i = 0; i < emailsToProcess.length; i += concurrency) {
    const chunk = emailsToProcess.slice(i, i + concurrency);
    const promises = chunk.map(async (row) => {
      try {
        const res = await verifyEmail(row.original_email, { mode: 'STANDARD', smtpTimeout: 10000 });
        return { status: 'fulfilled', value: { id: row.id, ...res } };
      } catch (e) {
        console.error(`Error verifying ${row.original_email}:`, e);
        return { status: 'fulfilled', value: { id: row.id, status: 'UNKNOWN', confidenceScore: 0, error: e.message } };
      }
    });
    const chunkResults = await Promise.all(promises);
    results.push(...chunkResults);
  }

  console.log('Results gathered:', results.length);
  
  const insertStmt = db.prepare(`
    INSERT INTO verification_results (
      email_id, syntax_valid, domain_valid, mx_valid, mx_host, disposable,
      role_based, free_provider, provider, catch_all, smtp_checked,
      smtp_status, smtp_code, smtp_message, confidence_score, status, risk_reasons
    ) VALUES (
      @id, @syntaxValid, @domainValid, @mxValid, @mxHost, @disposable,
      @roleBased, @freeProvider, @provider, @catchAll, @smtpChecked,
      @smtpStatus, @smtpCode, @smtpMessage, @confidenceScore, @status, @riskReasons
    )
  `);

  const runTx = db.transaction((resArray) => {
    for (const r of resArray) {
      if (r.status === 'fulfilled') {
        const d = r.value;
        const mapped = {
          id: d.id,
          syntaxValid: d.syntaxValid ? 1 : 0,
          domainValid: d.domainValid ? 1 : 0,
          mxValid: d.mxValid ? 1 : 0,
          mxHost: d.mxHost,
          disposable: d.disposable ? 1 : 0,
          roleBased: d.roleBased ? 1 : 0,
          freeProvider: d.freeProvider ? 1 : 0,
          provider: d.provider,
          catchAll: d.catchAll ? 1 : 0,
          smtpChecked: d.smtpChecked ? 1 : 0,
          smtpStatus: d.smtpStatus,
          smtpCode: d.smtpCode,
          smtpMessage: typeof d.smtpMessage === 'string' ? d.smtpMessage.substring(0, 200) : null,
          confidenceScore: d.confidenceScore || 0,
          status: d.status || 'UNKNOWN',
          riskReasons: d.riskReasons || null
        };
        try {
          insertStmt.run(mapped);
        } catch(e) {
          console.log('Failed to insert specific row:', mapped);
          throw e;
        }
      }
    }
  });

  try {
    runTx(results);
    console.log('DB Tx successful');
  } catch(e) {
    console.error('DB Insert Error:', e);
  }
}

const jobs = db.prepare("SELECT id FROM verification_jobs WHERE status = 'RUNNING' ORDER BY created_at ASC").all();
if (jobs.length > 0) {
  processJob(jobs[0].id).then(() => console.log('Done test.'));
} else {
  console.log('No RUNNING jobs to test.');
}
