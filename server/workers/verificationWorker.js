import db from '../database/database.js';
import { verifyEmail } from '../services/emailVerifier.js';

let isWorkerRunning = false;

async function processJob(jobId) {
  const jobStmt = db.prepare('SELECT * FROM verification_jobs WHERE id = ? AND status = ?');
  const job = jobStmt.get(jobId, 'RUNNING');
  if (!job) return;

  const emailsStmt = db.prepare(`
    SELECT e.id, e.original_email, e.normalized_email 
    FROM emails e
    LEFT JOIN verification_results r ON e.id = r.email_id
    WHERE e.job_id = ? AND r.id IS NULL
    LIMIT 10
  `);

  const emailsToProcess = emailsStmt.all(jobId);

  if (emailsToProcess.length === 0) {
    // Check if total matches processed
    const countStmt = db.prepare('SELECT COUNT(*) as c FROM verification_results r JOIN emails e ON r.email_id = e.id WHERE e.job_id = ?');
    const { c } = countStmt.get(jobId);
    
    if (c >= job.total_count) {
      db.prepare('UPDATE verification_jobs SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?').run('COMPLETED', jobId);
    } else {
       // Could be missing or some errors prevented save, just mark completed for now
       db.prepare('UPDATE verification_jobs SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?').run('COMPLETED', jobId);
    }
    return;
  }

  // Get settings for concurrency
  const concurrency = 5; // Default

  const insertStmt = db.prepare(`
    INSERT INTO verification_results (
      email_id, syntax_valid, domain_valid, mx_valid, mx_host, disposable,
      role_based, free_provider, provider, catch_all, smtp_checked,
      smtp_status, smtp_code, smtp_message, confidence_score, status, 
      verification_level, provider_blocked, risk_reasons
    ) VALUES (
      @id, @syntaxValid, @domainValid, @mxValid, @mxHost, @disposable,
      @roleBased, @freeProvider, @provider, @catchAll, @smtpChecked,
      @smtpStatus, @smtpCode, @smtpMessage, @confidenceScore, @status, 
      @verificationLevel, @providerBlocked, @riskReasons
    )
  `);

  const updateJobStats = db.prepare(`
    UPDATE verification_jobs 
    SET 
      processed_count = processed_count + ?,
      deliverable_count = deliverable_count + ?,
      undeliverable_count = undeliverable_count + ?,
      risky_count = risky_count + ?
    WHERE id = ?
  `);

  const runTx = db.transaction((resArray) => {
    let del = 0, und = 0, risky = 0;
    
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
          status: d.status || 'UNDELIVERABLE',
          verificationLevel: d.verification_level || 'UNVERIFIED',
          providerBlocked: d.provider_blocked ? 1 : 0,
          riskReasons: Array.isArray(d.reasons) ? d.reasons.join(', ') : (d.riskReasons || null)
        };
        insertStmt.run(mapped);

        if (mapped.status === 'DELIVERABLE') del++;
        else if (mapped.status === 'RISKY') risky++;
        else und++;
      } else {
        und++; // rejected promise
      }
    }

    updateJobStats.run(resArray.length, del, und, risky, jobId);
  });

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
    
    // Save to DB in transaction immediately after chunk finishes
    try {
      runTx(chunkResults);
    } catch(e) {
      console.error('DB Insert Error:', e);
    }
  }
}

export function startWorker() {
  if (isWorkerRunning) return;
  isWorkerRunning = true;

  console.log('Worker started...');
  
  const tick = async () => {
    try {
      // Find RUNNING jobs
      const jobs = db.prepare("SELECT id FROM verification_jobs WHERE status = 'RUNNING' ORDER BY created_at ASC").all();
      
      if (jobs.length > 0) {
        // Process a chunk for the first job
        await processJob(jobs[0].id);
        setTimeout(tick, 100); // short delay
      } else {
        setTimeout(tick, 2000); // idle delay
      }
    } catch (e) {
      console.error('Worker loop error:', e);
      setTimeout(tick, 5000); // backoff
    }
  };

  tick();
}
