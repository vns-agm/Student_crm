import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@libsql/client'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const DEFAULT_TENANT_ID = '00000000-0000-4000-8000-000000000001'

function createDbClient() {
  const url = process.env.TURSO_DATABASE_URL?.trim()
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim()

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

let initPromise

export function ensureDb() {
  if (!initPromise) {
    initPromise = (async () => {
      if (!db) {
        throw new Error(
          'Database not configured for Vercel. Add TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in Vercel → Settings → Environment Variables, then redeploy.',
        )
      }

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
      await ensureColumn('users', 'tenant_id', 'TEXT')
      await ensureColumn('tournaments', 'tenant_id', 'TEXT')
      await ensureColumn('tournament_players', 'category', "TEXT NOT NULL DEFAULT 'open'")

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
            'Agm-Chess Classes',
            'agm-chess',
            'Agm-Chess Classes',
            '',
            '#1a4d3e',
            '#b8892c',
            new Date().toISOString(),
          ],
        })
      }

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

      const { hashPassword } = await import('./auth.js')
      const defaults = [
        { username: 'admin', password: 'admin123', role: 'admin' },
        { username: 'parent', password: 'parent123', role: 'parent' },
      ]

      for (const account of defaults) {
        const existing = await db.execute({
          sql: 'SELECT id FROM users WHERE username = ?',
          args: [account.username],
        })
        if (!existing.rows[0]) {
          await db.execute({
            sql: `INSERT INTO users (id, username, password_hash, role, tenant_id, created_at)
                  VALUES (?, ?, ?, ?, ?, ?)`,
            args: [
              crypto.randomUUID(),
              account.username,
              hashPassword(account.password),
              account.role,
              DEFAULT_TENANT_ID,
              new Date().toISOString(),
            ],
          })
        }
      }
    })()
  }

  return initPromise
}

export { mapTenantRow }
