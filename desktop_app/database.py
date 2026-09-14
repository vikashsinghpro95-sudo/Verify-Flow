import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'data', 'emails.sqlite')

def get_connection():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute('PRAGMA journal_mode=WAL')
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
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
    )
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS emails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL,
      original_email TEXT NOT NULL,
      normalized_email TEXT NOT NULL,
      domain TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (job_id) REFERENCES verification_jobs (id) ON DELETE CASCADE
    )
    ''')

    cursor.execute('''
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
      risk_reasons TEXT,
      verified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (email_id) REFERENCES emails (id) ON DELETE CASCADE
    )
    ''')

    # Indexes
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_emails_job_id ON emails(job_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_results_status ON verification_results(status)')
    
    conn.commit()
    conn.close()

if __name__ == '__main__':
    init_db()
