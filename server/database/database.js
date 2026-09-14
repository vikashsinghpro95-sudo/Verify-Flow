import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure data directory exists
const dataDir = path.resolve(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = process.env.DATABASE_PATH || path.join(dataDir, 'emails.sqlite');
const db = new Database(dbPath);

// Performance pragmas for SQLite
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');

// Initialize schema
const schemaPath = path.join(__dirname, 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');

// better-sqlite3 exec runs multiple statements
db.exec(schema);

// Migration for newly added columns
try {
  const tableInfo = db.prepare("PRAGMA table_info(verification_results)").all();
  const columns = tableInfo.map(c => c.name);
  if (!columns.includes('verification_level')) {
    db.exec("ALTER TABLE verification_results ADD COLUMN verification_level TEXT");
  }
  if (!columns.includes('provider_blocked')) {
    db.exec("ALTER TABLE verification_results ADD COLUMN provider_blocked BOOLEAN DEFAULT 0");
  }
} catch (e) {
  console.error("Migration error:", e);
}

export default db;
