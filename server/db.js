import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@libsql/client'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function createDbClient() {
  if (process.env.TURSO_DATABASE_URL) {
    return createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
  }

  const dataDir = path.join(__dirname, 'data')
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }

  return createClient({
    url: `file:${path.join(dataDir, 'student-crm.db')}`,
  })
}

export const db = createDbClient()

async function ensureColumn(table, column, definition) {
  const result = await db.execute(`PRAGMA table_info(${table})`)
  const exists = result.rows.some((row) => row.name === column)
  if (!exists) {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  }
}

let initPromise

export function ensureDb() {
  if (!initPromise) {
    initPromise = (async () => {
      await db.executeMultiple(`
        CREATE TABLE IF NOT EXISTS students (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          age INTEGER NOT NULL,
          payment_date TEXT NOT NULL DEFAULT '',
          number_of_classes INTEGER NOT NULL DEFAULT 0,
          fees_per_class REAL NOT NULL DEFAULT 0,
          batch TEXT NOT NULL DEFAULT 'beginner',
          total_fees REAL NOT NULL DEFAULT 0,
          amount_paid REAL NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS attendance (
          id TEXT PRIMARY KEY,
          student_id TEXT NOT NULL,
          date TEXT NOT NULL,
          status TEXT NOT NULL,
          UNIQUE (student_id, date),
          FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS payments (
          id TEXT PRIMARY KEY,
          student_id TEXT NOT NULL,
          amount REAL NOT NULL,
          date TEXT NOT NULL,
          note TEXT NOT NULL DEFAULT '',
          FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
        );
      `)

      await ensureColumn('students', 'payment_date', "TEXT NOT NULL DEFAULT ''")
      await ensureColumn('students', 'number_of_classes', 'INTEGER NOT NULL DEFAULT 0')
      await ensureColumn('students', 'fees_per_class', 'REAL NOT NULL DEFAULT 0')
      await ensureColumn('students', 'batch', "TEXT NOT NULL DEFAULT 'beginner'")
      await ensureColumn('students', 'amount_paid', 'REAL NOT NULL DEFAULT 0')
    })()
  }

  return initPromise
}
