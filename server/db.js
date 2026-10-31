import { AsyncLocalStorage } from 'node:async_hooks'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@libsql/client'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const DEFAULT_TENANT_ID = '00000000-0000-4000-8000-000000000001'

function createDbClient(urlEnv, tokenEnv, localFile) {
  const url = process.env[urlEnv]?.trim()
  const authToken = process.env[tokenEnv]?.trim()

  if (url) {
    return createClient({ url, authToken })
  }

  if (process.env.VERCEL) {
    return null
  }

  const dataDir = path.join(__dirname, 'data')
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }

  return createClient({
    url: `file:${path.join(dataDir, localFile)}`,
  })
}

const primaryClient = createDbClient(
  'TURSO_DATABASE_URL',
  'TURSO_AUTH_TOKEN',
  'student-crm.db',
)

// Demo logins run against their own database with the same tables, so demo
// sessions can never read or change real student data.
const demoUrl = process.env.DEMO_TURSO_DATABASE_URL?.trim()
const demoClient =
  demoUrl && demoUrl === process.env.TURSO_DATABASE_URL?.trim()
    ? null
    : createDbClient('DEMO_TURSO_DATABASE_URL', 'DEMO_TURSO_AUTH_TOKEN', 'student-crm-demo.db')

const dbContext = new AsyncLocalStorage()

function currentClient() {
  return dbContext.getStore() ?? primaryClient
}

export const db = {
  execute: (...args) => currentClient().execute(...args),
  batch: (...args) => currentClient().batch(...args),
  executeMultiple: (...args) => currentClient().executeMultiple(...args),
}

export function getDemoClient() {
  if (!demoClient) {
    throw new Error(
      'Demo database not configured. Set DEMO_TURSO_DATABASE_URL and DEMO_TURSO_AUTH_TOKEN.',
    )
  }
  return demoClient
}

export function runWithDemoDb(fn) {
  return dbContext.run(getDemoClient(), fn)
}

async function hasColumn(table, column) {
  const result = await db.execute(`PRAGMA table_info(${table})`)
  return result.rows.some((row) => row.name === column)
}

async function ensureColumn(table, column, definition) {
  if (!(await hasColumn(table, column))) {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  }
}

// One-time migration: older databases tracked cycles only through a running
// count (cycle_start_classes). Tag every attendance row with the package
// cycle it belongs to so class numbers restart at 1 after each renewal.
async function backfillCycles() {
  const students = await db.execute('SELECT id, number_of_classes FROM students')
  const statements = []

  for (const student of students.rows) {
    const renewals = await db.execute({
      sql: `SELECT id, date, classes_at_renewal FROM renewals
            WHERE student_id = ? ORDER BY created_at ASC`,
      args: [student.id],
    })
    const attendance = await db.execute({
      sql: 'SELECT id, date, status FROM attendance WHERE student_id = ? ORDER BY date ASC',
      args: [student.id],
    })

    let held = 0
    for (const record of attendance.rows) {
      const isHeld = record.status === 'present' || record.status === 'late'
      let cycle = 1
      for (const r of renewals.rows) {
        const boundaryPassed = isHeld
          ? held >= Number(r.classes_at_renewal)
          : record.date >= r.date
        if (boundaryPassed) cycle += 1
      }
      if (isHeld) held += 1
      statements.push({
        sql: 'UPDATE attendance SET cycle_no = ? WHERE id = ?',
        args: [cycle, record.id],
      })
    }

    renewals.rows.forEach((r, index) => {
      statements.push({
        sql: `UPDATE renewals SET cycle_number = ?, classes_in_package = ?
              WHERE id = ?`,
        args: [index + 2, student.number_of_classes, r.id],
      })
    })
    statements.push({
      sql: 'UPDATE students SET current_cycle = ? WHERE id = ?',
      args: [renewals.rows.length + 1, student.id],
    })
  }

  if (statements.length > 0) {
    await db.batch(statements, 'write')
  }
}

function mapTenantRow(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    displayName: row.display_name,
    logoUrl: row.logo_url || '',
    primaryColor: row.primary_color || '#1a4d3e',
    accentColor: row.accent_color || '#b8892c',
    createdAt: row.created_at,
  }
}

export async function getTenantById(id) {
  const result = await db.execute({
    sql: 'SELECT * FROM tenants WHERE id = ?',
    args: [id],
  })
  return mapTenantRow(result.rows[0])
}

async function createSchema() {
      await db.executeMultiple(`
        CREATE TABLE IF NOT EXISTS tenants (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          slug TEXT NOT NULL UNIQUE,
          display_name TEXT NOT NULL,
          logo_url TEXT NOT NULL DEFAULT '',
          primary_color TEXT NOT NULL DEFAULT '#1a4d3e',
          accent_color TEXT NOT NULL DEFAULT '#b8892c',
          created_at TEXT NOT NULL
        );

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
          category TEXT NOT NULL DEFAULT 'open',
          tenant_id TEXT,
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
          is_renewal INTEGER NOT NULL DEFAULT 0,
          FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS renewals (
          id TEXT PRIMARY KEY,
          student_id TEXT NOT NULL,
          payment_id TEXT,
          amount REAL NOT NULL,
          date TEXT NOT NULL,
          note TEXT NOT NULL DEFAULT '',
          classes_at_renewal INTEGER NOT NULL DEFAULT 0,
          sessions_in_cycle INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('admin', 'parent')),
          tenant_id TEXT,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS tournaments (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          category TEXT NOT NULL DEFAULT 'open',
          rounds INTEGER NOT NULL DEFAULT 0,
          current_round INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'setup',
          tenant_id TEXT,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS tournament_players (
          id TEXT PRIMARY KEY,
          tournament_id TEXT NOT NULL,
          student_id TEXT,
          name TEXT NOT NULL,
          category TEXT NOT NULL DEFAULT 'open',
          FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS tournament_pairings (
          id TEXT PRIMARY KEY,
          tournament_id TEXT NOT NULL,
          round INTEGER NOT NULL,
          board INTEGER NOT NULL,
          white_id TEXT NOT NULL,
          black_id TEXT,
          result TEXT,
          FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
        );
      `)

      await ensureColumn('students', 'payment_date', "TEXT NOT NULL DEFAULT ''")
      await ensureColumn('students', 'number_of_classes', 'INTEGER NOT NULL DEFAULT 0')
      await ensureColumn('students', 'fees_per_class', 'REAL NOT NULL DEFAULT 0')
      await ensureColumn('students', 'batch', "TEXT NOT NULL DEFAULT 'beginner'")
      await ensureColumn('students', 'amount_paid', 'REAL NOT NULL DEFAULT 0')
      await ensureColumn('students', 'category', "TEXT NOT NULL DEFAULT 'open'")
      await ensureColumn('students', 'tenant_id', 'TEXT')
      await ensureColumn('students', 'cycle_start_classes', 'INTEGER NOT NULL DEFAULT 0')
      await ensureColumn('payments', 'is_renewal', 'INTEGER NOT NULL DEFAULT 0')
      const needsCycleBackfill = !(await hasColumn('attendance', 'cycle_no'))
      await ensureColumn('students', 'current_cycle', 'INTEGER NOT NULL DEFAULT 1')
      await ensureColumn('attendance', 'cycle_no', 'INTEGER NOT NULL DEFAULT 1')
      await ensureColumn('renewals', 'cycle_number', 'INTEGER NOT NULL DEFAULT 0')
      await ensureColumn('renewals', 'classes_in_package', 'INTEGER NOT NULL DEFAULT 0')
      await ensureColumn('renewals', 'previous_classes', 'INTEGER NOT NULL DEFAULT 0')
      if (needsCycleBackfill) {
        await backfillCycles()
      }
      await ensureColumn('users', 'tenant_id', 'TEXT')
      await ensureColumn('users', 'is_owner', 'INTEGER NOT NULL DEFAULT 0')
      await ensureColumn('tournaments', 'tenant_id', 'TEXT')
      await ensureColumn('tournament_players', 'category', "TEXT NOT NULL DEFAULT 'open'")
}

let initPromise
let demoInitPromise

// Same tables as the live database; demoData.js fills them with sample data.
export function ensureDemoDb() {
  if (!demoInitPromise) {
    demoInitPromise = runWithDemoDb(createSchema).catch((error) => {
      demoInitPromise = undefined
      throw error
    })
  }
  return demoInitPromise
}

export function ensureDb() {
  if (!initPromise) {
    initPromise = (async () => {
      if (!primaryClient) {
        throw new Error(
          'Database not configured for Vercel. Add TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in Vercel → Settings → Environment Variables, then redeploy.',
        )
      }

      await createSchema()

      const existingTenant = await db.execute({
        sql: 'SELECT id FROM tenants WHERE id = ?',
        args: [DEFAULT_TENANT_ID],
      })
      if (!existingTenant.rows[0]) {
        await db.execute({
          sql: `INSERT INTO tenants (
                  id, name, slug, display_name, logo_url,
                  primary_color, accent_color, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            DEFAULT_TENANT_ID,
            'Agam Chess Classes',
            'agm-chess',
            'Agam Chess Classes',
            '',
            '#1a4d3e',
            '#b8892c',
            new Date().toISOString(),
          ],
        })
      }

      // Rename the academy, leaving any name set in white-label settings alone.
      await db.execute({
        sql: `UPDATE tenants SET name = 'Agam Chess Classes', display_name = 'Agam Chess Classes'
              WHERE id = ? AND display_name = 'Agm-Chess Classes'`,
        args: [DEFAULT_TENANT_ID],
      })

      await db.execute({
        sql: 'UPDATE users SET tenant_id = ? WHERE tenant_id IS NULL OR tenant_id = \'\'',
        args: [DEFAULT_TENANT_ID],
      })
      await db.execute({
        sql: 'UPDATE students SET tenant_id = ? WHERE tenant_id IS NULL OR tenant_id = \'\'',
        args: [DEFAULT_TENANT_ID],
      })
      await db.execute({
        sql: 'UPDATE tournaments SET tenant_id = ? WHERE tenant_id IS NULL OR tenant_id = \'\'',
        args: [DEFAULT_TENANT_ID],
      })

      // Platform owner: original admin on the default tenant only
      await db.execute({
        sql: `UPDATE users
              SET is_owner = 1
              WHERE username = 'admin' AND tenant_id = ? AND role = 'admin'`,
        args: [DEFAULT_TENANT_ID],
      })

      const { hashPassword } = await import('./auth.js')

      // The admin password comes only from ADMIN_PASSWORD, never from source code.
      const adminPassword = process.env.ADMIN_PASSWORD?.trim()
      const admin = await db.execute({
        sql: 'SELECT id FROM users WHERE username = ?',
        args: ['admin'],
      })
      if (adminPassword && admin.rows[0]) {
        await db.execute({
          sql: `UPDATE users SET password_hash = ?, is_owner = 1 WHERE username = 'admin' AND tenant_id = ?`,
          args: [hashPassword(adminPassword), DEFAULT_TENANT_ID],
        })
      } else if (adminPassword) {
        await db.execute({
          sql: `INSERT INTO users (id, username, password_hash, role, tenant_id, is_owner, created_at)
                VALUES (?, 'admin', ?, 'admin', ?, 1, ?)`,
          args: [
            crypto.randomUUID(),
            hashPassword(adminPassword),
            DEFAULT_TENANT_ID,
            new Date().toISOString(),
          ],
        })
      } else if (!admin.rows[0]) {
        console.warn('No admin account: set ADMIN_PASSWORD to create one.')
      }

      // Lock the old sample parent login, whose password was public in source code.
      await db.execute({
        sql: `UPDATE users SET password_hash = '!' WHERE username = 'parent' AND password_hash = ?`,
        args: ['1e6ae67b070d416bc3872fed81f88734287c0f855c5b0adce89eb5f1c8510dc1'],
      })
    })()
  }

  return initPromise
}

export { mapTenantRow }
