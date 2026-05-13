import Database, { Database as DB } from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS loans (
  id TEXT PRIMARY KEY,
  borrower_id TEXT NOT NULL,
  principal INTEGER NOT NULL CHECK (principal > 0),
  rate REAL NOT NULL,
  roi REAL NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('proposed','approved','invested','disbursed')),
  agreement_letter_url TEXT,
  picture_proof_url TEXT,
  validator_employee_id TEXT,
  approved_at TEXT,
  signed_agreement_url TEXT,
  field_officer_employee_id TEXT,
  disbursed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS investments (
  id TEXT PRIMARY KEY,
  loan_id TEXT NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  investor_id TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  invested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_investments_loan_id ON investments(loan_id);
`;

export function openDatabase(dbPath: string): DB {
    if (dbPath !== ':memory:') {
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.exec(SCHEMA);
    return db;
}

export type Db = DB;
