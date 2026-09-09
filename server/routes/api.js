import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import csvParser from 'csv-parser';
import * as xlsx from 'xlsx';
import db from '../database/database.js';
import { verifyEmail } from '../services/emailVerifier.js';

const router = express.Router();
const upload = multer({ dest: '../uploads/' });

// Helper to process uploaded file and insert emails into DB
async function processFileAndCreateJob(filePath, originalname) {
  let emails = new Set();
  const ext = path.extname(originalname).toLowerCase();
  
  if (ext === '.csv' || ext === '.txt') {
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csvParser({ headers: false }))
        .on('data', (data) => {
          // Find first value that looks like an email if it's a row
          for (let key in data) {
            const val = String(data[key]).trim();
            if (val.includes('@')) {
               emails.add(val);
               break; // only one email per row to be safe
            }
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });
  } else if (ext === '.xlsx') {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    
    for (const row of data) {
      for (const cell of row) {
        const val = String(cell).trim();
        if (val.includes('@')) {
          emails.add(val);
          break;
        }
      }
    }
  }

  // Deduplicate and normalize
  const uniqueEmails = Array.from(emails).map(e => ({
    original: e,
    normalized: e.toLowerCase() // basic lowercase
  })).filter(e => e.original.length > 0);

  if (uniqueEmails.length === 0) throw new Error('No valid emails found in file.');

  const result = db.transaction(() => {
    const jobInsert = db.prepare(`INSERT INTO verification_jobs (name, filename, total_count) VALUES (?, ?, ?)`).run(`Job ${new Date().getTime()}`, originalname, uniqueEmails.length);
    const jobId = jobInsert.lastInsertRowid;
    
    const emailInsert = db.prepare(`INSERT INTO emails (job_id, original_email, normalized_email, domain) VALUES (?, ?, ?, ?)`);
    
    for (const em of uniqueEmails) {
      const parts = em.normalized.split('@');
      const domain = parts.length > 1 ? parts[1] : '';
      emailInsert.run(jobId, em.original, em.normalized, domain);
    }
    
    return { jobId, totalCount: uniqueEmails.length };
  })();

  return result;
}

router.post('/jobs', upload.single('file'), async (req, res) => {
  try {
    let result;
    if (req.file) {
      result = await processFileAndCreateJob(req.file.path, req.file.originalname);
      fs.unlinkSync(req.file.path); // clean up
    } else if (req.body.emails) {
      // Paste emails fallback
      const rawEmails = req.body.emails.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
      const uniqueEmails = Array.from(new Set(rawEmails)).map(e => ({
        original: e,
        normalized: e.toLowerCase()
      }));

      result = db.transaction(() => {
        const jobInsert = db.prepare(`INSERT INTO verification_jobs (name, filename, total_count) VALUES (?, ?, ?)`).run(`Manual Paste ${new Date().getTime()}`, 'Pasted', uniqueEmails.length);
        const jobId = jobInsert.lastInsertRowid;
        const emailInsert = db.prepare(`INSERT INTO emails (job_id, original_email, normalized_email, domain) VALUES (?, ?, ?, ?)`);
        for (const em of uniqueEmails) {
          const parts = em.normalized.split('@');
          const domain = parts.length > 1 ? parts[1] : '';
          emailInsert.run(jobId, em.original, em.normalized, domain);
        }
        return { jobId, totalCount: uniqueEmails.length };
      })();
    } else {
      return res.status(400).json({ error: 'No file or emails provided' });
    }

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/jobs/:id/start', (req, res) => {
  db.prepare("UPDATE verification_jobs SET status = 'RUNNING' WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

router.post('/jobs/:id/pause', (req, res) => {
  db.prepare("UPDATE verification_jobs SET status = 'PAUSED' WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

router.post('/jobs/:id/cancel', (req, res) => {
  db.prepare("UPDATE verification_jobs SET status = 'CANCELLED' WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

router.delete('/jobs/:id', (req, res) => {
  db.prepare("DELETE FROM verification_jobs WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

router.get('/jobs', (req, res) => {
  const jobs = db.prepare("SELECT * FROM verification_jobs ORDER BY created_at DESC").all();
  res.json(jobs);
});

router.get('/jobs/:id', (req, res) => {
  const job = db.prepare("SELECT * FROM verification_jobs WHERE id = ?").get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Not found' });
  res.json(job);
});

router.get('/jobs/:id/results', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;

  const results = db.prepare(`
    SELECT e.original_email, r.* 
    FROM emails e 
    JOIN verification_results r ON e.id = r.email_id 
    WHERE e.job_id = ? 
    ORDER BY r.id ASC 
    LIMIT ? OFFSET ?
  `).all(req.params.id, limit, offset);

  res.json(results);
});

router.get('/jobs/:id/export', (req, res) => {
  const type = req.query.type || 'all'; // all, deliverable, risky, undeliverable, unknown
  
  let query = `
    SELECT e.original_email as email, r.status, r.confidence_score, r.risk_reasons
    FROM emails e
    JOIN verification_results r ON e.id = r.email_id
    WHERE e.job_id = ?
  `;
  
  const params = [req.params.id];
  
  if (type !== 'all') {
    query += ` AND r.status = ?`;
    params.push(type.toUpperCase());
  }
  
  const rows = db.prepare(query).all(...params);
  
  // Basic CSV export
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="export_${type}.csv"`);
  
  res.write('Email,Status,Score,Reasons\n');
  rows.forEach(r => {
    res.write(`${r.email},${r.status},${r.confidence_score},"${r.risk_reasons || ''}"\n`);
  });
  
  res.end();
});

router.post('/verify', async (req, res) => {
  try {
    const email = req.body.email;
    if (!email) return res.status(400).json({ error: 'Email required' });
    
    const result = await verifyEmail(email);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
