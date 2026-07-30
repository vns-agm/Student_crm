import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, 'data')

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const db = new Database(path.join(dataDir, 'student-crm.db'))

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    age INTEGER NOT NULL,
    payment_date TEXT NOT NULL DEFAULT '',
    number_of_classes INTEGER NOT NULL DEFAULT 0,
    fees_per_class REAL NOT NULL DEFAULT 0,
    batch TEXT NOT NULL DEFAULT 'beginner'
      CHECK (batch IN ('beginner', 'intermediate', 'advanced')),
    total_fees REAL NOT NULL DEFAULT 0,
    amount_paid REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    date TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late')),
    UNIQUE (student_id, date),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    amount REAL NOT NULL CHECK (amount > 0),
    date TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
  );
`)

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all()
  if (!columns.some((col) => col.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  }
}

ensureColumn('students', 'payment_date', "TEXT NOT NULL DEFAULT ''")
ensureColumn('students', 'number_of_classes', 'INTEGER NOT NULL DEFAULT 0')
ensureColumn('students', 'fees_per_class', 'REAL NOT NULL DEFAULT 0')
ensureColumn('students', 'batch', "TEXT NOT NULL DEFAULT 'beginner'")
ensureColumn('students', 'amount_paid', 'REAL NOT NULL DEFAULT 0')

export default db
