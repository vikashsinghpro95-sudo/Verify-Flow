CREATE TABLE IF NOT EXISTS verification_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  filename TEXT,
  total_count INTEGER DEFAULT 0,
  processed_count INTEGER DEFAULT 0,
  deliverable_count INTEGER DEFAULT 0,
  risky_count INTEGER DEFAULT 0,
  undeliverable_count INTEGER DEFAULT 0,
  unknown_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'PENDING',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

CREATE TABLE IF NOT EXISTS emails (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL,
  original_email TEXT NOT NULL,
  normalized_email TEXT NOT NULL,
  domain TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_id) REFERENCES verification_jobs (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS verification_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email_id INTEGER NOT NULL UNIQUE,
  syntax_valid BOOLEAN,
  domain_valid BOOLEAN,
  mx_valid BOOLEAN,
  mx_host TEXT,
  disposable BOOLEAN,
  role_based BOOLEAN,
  free_provider BOOLEAN,
  provider TEXT,
  catch_all BOOLEAN,
  smtp_checked BOOLEAN,
  smtp_status TEXT,
  smtp_code INTEGER,
  smtp_message TEXT,
  confidence_score INTEGER,
  status TEXT,
  verification_level TEXT,
  provider_blocked BOOLEAN DEFAULT 0,
  risk_reasons TEXT,
  verified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (email_id) REFERENCES emails (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_emails_job_id ON emails(job_id);
CREATE INDEX IF NOT EXISTS idx_emails_normalized_email ON emails(normalized_email);
CREATE INDEX IF NOT EXISTS idx_emails_domain ON emails(domain);
CREATE INDEX IF NOT EXISTS idx_results_status ON verification_results(status);
CREATE INDEX IF NOT EXISTS idx_results_email_id ON verification_results(email_id);
