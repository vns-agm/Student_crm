import cors from 'cors'
import express from 'express'
import {
  createToken,
  hashPassword,
  requireAdmin,
  requireAuth,
  requireOwner,
} from './auth.js'
import { db, ensureDb, getTenantById } from './db.js'
import { computeStandings, makeSwissPairings } from './swiss.js'

const app = express()
const PORT = process.env.PORT || 3001
const BATCHES = new Set(['beginner', 'intermediate', 'advanced'])
const CATEGORIES = new Set(['u10', 'u15', 'open'])
const SESSIONS_PER_CYCLE = 8

function countClassesHeld(attendanceRows) {
  return attendanceRows.filter(
    (a) => a.status === 'present' || a.status === 'late',
  ).length
}

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    database: process.env.TURSO_DATABASE_URL
      ? 'turso'
      : process.env.VERCEL
        ? 'missing-turso'
        : 'local-file',
    vercel: Boolean(process.env.VERCEL),
  })
})

app.use(async (req, res, next) => {
  if (req.path === '/api/health') return next()
  try {
    await ensureDb()
    next()
  } catch (error) {
    next(error)
  }
})

async function mapStudent(row) {
  const attendance = await db.execute({
    sql: `SELECT id, date, status
          FROM attendance
          WHERE student_id = ?
          ORDER BY date DESC`,
    args: [row.id],
  })

  const payments = await db.execute({
    sql: `SELECT id, amount, date, note, is_renewal
          FROM payments
          WHERE student_id = ?
          ORDER BY date DESC, rowid DESC`,
    args: [row.id],
  })

  const renewals = await db.execute({
    sql: `SELECT id, payment_id, amount, date, note, classes_at_renewal, sessions_in_cycle, created_at
          FROM renewals
          WHERE student_id = ?
          ORDER BY created_at DESC`,
    args: [row.id],
  })

  const classesHeld = countClassesHeld(attendance.rows)
  const cycleStart = row.cycle_start_classes ?? 0
  const sessionsInCycle = Math.max(0, classesHeld - cycleStart)

  return {
    id: row.id,
    name: row.name,
    age: row.age,
    paymentDate: row.payment_date,
    numberOfClasses: row.number_of_classes,
    feesPerClass: row.fees_per_class,
    batch: row.batch,
    category: row.category || 'open',
    totalFees: row.total_fees,
    amountPaid: row.amount_paid ?? 0,
    cycleStartClasses: cycleStart,
    sessionsInCycle,
    renewalPending: sessionsInCycle >= SESSIONS_PER_CYCLE,
    renewalCount: renewals.rows.length,
    createdAt: row.created_at,
    attendance: attendance.rows,
    payments: payments.rows.map((p) => ({
      id: p.id,
      amount: p.amount,
      date: p.date,
      note: p.note,
      isRenewal: Boolean(p.is_renewal),
    })),
    renewals: renewals.rows.map((r) => ({
      id: r.id,
      paymentId: r.payment_id,
      amount: r.amount,
      date: r.date,
      note: r.note,
      classesAtRenewal: r.classes_at_renewal,
      sessionsInCycle: r.sessions_in_cycle,
      createdAt: r.created_at,
    })),
  }
}

function parseStudentBody(body) {
  const name = String(body?.name ?? '').trim()
  const age = Number(body?.age)
  const paymentDate = String(body?.paymentDate ?? '').trim()
  const numberOfClasses = Number(body?.numberOfClasses)
  const feesPerClass = Number(body?.feesPerClass)
  const amountPaid = Number(body?.amountPaid)
  const batch = String(body?.batch ?? '').trim()
  const category = String(body?.category ?? '').trim()

  if (!name) {
    return { error: 'Name is required.' }
  }
  if (!Number.isFinite(age) || age < 3 || age > 100) {
    return { error: 'Enter a valid age (3–100).' }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) {
    return { error: 'Payment date is required (YYYY-MM-DD).' }
  }
  if (!Number.isInteger(numberOfClasses) || numberOfClasses < 1) {
    return { error: 'Enter a valid number of classes (1 or more).' }
  }
  if (!Number.isFinite(feesPerClass) || feesPerClass < 0) {
    return { error: 'Enter a valid fees per class amount.' }
  }
  if (!Number.isFinite(amountPaid) || amountPaid < 0) {
    return { error: 'Enter a valid amount paid.' }
  }
  if (!BATCHES.has(batch)) {
    return { error: 'Batch must be beginner, intermediate, or advanced.' }
  }
  if (!CATEGORIES.has(category)) {
    return { error: 'Category must be U-10, U-15, or Open.' }
  }

  const totalFees = numberOfClasses * feesPerClass
  if (amountPaid > totalFees) {
    return { error: 'Amount paid cannot be more than total fees.' }
  }

  return {
    name,
    age,
    paymentDate,
    numberOfClasses,
    feesPerClass,
    amountPaid,
    batch,
    category,
    totalFees,
  }
}

async function getStudentRow(id, tenantId) {
  const result = await db.execute({
    sql: 'SELECT * FROM students WHERE id = ? AND tenant_id = ?',
    args: [id, tenantId],
  })
  return result.rows[0] ?? null
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
}

function isHexColor(value) {
  return /^#[0-9a-fA-F]{6}$/.test(value)
}

async function buildAuthUser(row) {
  const branding = await getTenantById(row.tenant_id)
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    tenantId: row.tenant_id,
    isOwner: Boolean(row.is_owner),
    branding,
  }
}

app.post('/api/login', async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? '').trim()
    const password = String(req.body?.password ?? '')

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' })
    }

    const result = await db.execute({
      sql: 'SELECT id, username, password_hash, role, tenant_id, is_owner FROM users WHERE username = ?',
      args: [username],
    })
    const user = result.rows[0]
    if (!user || user.password_hash !== hashPassword(password)) {
      return res.status(401).json({ error: 'Invalid username or password.' })
    }
    if (!user.tenant_id) {
      return res.status(401).json({ error: 'Account is not linked to a CRM.' })
    }

    const token = createToken(user)
    res.json({
      token,
      user: await buildAuthUser(user),
    })
  } catch (error) {
    next(error)
  }
})

app.get('/api/me', requireAuth, async (req, res, next) => {
  try {
    const result = await db.execute({
      sql: 'SELECT id, username, role, tenant_id, is_owner FROM users WHERE id = ?',
      args: [req.user.id],
    })
    const row = result.rows[0]
    if (!row) {
      return res.status(401).json({ error: 'Please log in to continue.' })
    }
    res.json({ user: await buildAuthUser(row) })
  } catch (error) {
    next(error)
  }
})

app.get('/api/branding', requireAuth, async (req, res, next) => {
  try {
    const branding = await getTenantById(req.user.tenantId)
    if (!branding) {
      return res.status(404).json({ error: 'Branding not found.' })
    }
    res.json(branding)
  } catch (error) {
    next(error)
  }
})

app.put('/api/branding', requireAuth, requireOwner, async (req, res, next) => {
  try {
    const displayName = String(req.body?.displayName ?? '').trim()
    const logoUrl = String(req.body?.logoUrl ?? '').trim()
    const primaryColor = String(req.body?.primaryColor ?? '').trim()
    const accentColor = String(req.body?.accentColor ?? '').trim()

    if (!displayName) {
      return res.status(400).json({ error: 'Display name is required.' })
    }
    if (!isHexColor(primaryColor) || !isHexColor(accentColor)) {
      return res.status(400).json({ error: 'Colors must be hex values like #1a4d3e.' })
    }
    if (logoUrl && !/^https?:\/\//i.test(logoUrl)) {
      return res.status(400).json({ error: 'Logo URL must start with http:// or https://.' })
    }

    await db.execute({
      sql: `UPDATE tenants
             SET display_name = ?, name = ?, logo_url = ?, primary_color = ?, accent_color = ?
             WHERE id = ?`,
      args: [
        displayName,
        displayName,
        logoUrl,
        primaryColor,
        accentColor,
        req.user.tenantId,
      ],
    })

    res.json(await getTenantById(req.user.tenantId))
  } catch (error) {
    next(error)
  }
})

app.get('/api/tenant/users', requireAuth, requireOwner, async (req, res, next) => {
  try {
    const result = await db.execute({
      sql: `SELECT id, username, role, created_at
            FROM users
            WHERE tenant_id = ?
            ORDER BY role, username`,
      args: [req.user.tenantId],
    })
    res.json(
      result.rows.map((row) => ({
        id: row.id,
        username: row.username,
        role: row.role,
        createdAt: row.created_at,
      })),
    )
  } catch (error) {
    next(error)
  }
})

app.post('/api/tenant/parents', requireAuth, requireOwner, async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? '').trim()
    const password = String(req.body?.password ?? '')

    if (!username || username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters.' })
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' })
    }

    const existing = await db.execute({
      sql: 'SELECT id FROM users WHERE username = ?',
      args: [username],
    })
    if (existing.rows[0]) {
      return res.status(400).json({ error: 'That username is already taken.' })
    }

    const id = crypto.randomUUID()
    await db.execute({
      sql: `INSERT INTO users (id, username, password_hash, role, tenant_id, is_owner, created_at)
            VALUES (?, ?, ?, 'parent', ?, 0, ?)`,
      args: [id, username, hashPassword(password), req.user.tenantId, new Date().toISOString()],
    })

    res.status(201).json({
      id,
      username,
      role: 'parent',
      createdAt: new Date().toISOString(),
    })
  } catch (error) {
    next(error)
  }
})

app.post('/api/tenant/coaches', requireAuth, requireOwner, async (req, res, next) => {
  try {
    const academyName = String(req.body?.academyName ?? '').trim()
    const adminUsername = String(req.body?.adminUsername ?? '').trim()
    const adminPassword = String(req.body?.adminPassword ?? '')
    const parentUsername = String(req.body?.parentUsername ?? '').trim()
    const parentPassword = String(req.body?.parentPassword ?? '')
    const primaryColor = String(req.body?.primaryColor ?? '#1a4d3e').trim()
    const accentColor = String(req.body?.accentColor ?? '#b8892c').trim()

    if (!academyName) {
      return res.status(400).json({ error: 'Academy name is required.' })
    }
    if (!adminUsername || adminUsername.length < 3) {
      return res.status(400).json({ error: 'Coach username must be at least 3 characters.' })
    }
    if (!adminPassword || adminPassword.length < 6) {
      return res.status(400).json({ error: 'Coach password must be at least 6 characters.' })
    }
    if (!isHexColor(primaryColor) || !isHexColor(accentColor)) {
      return res.status(400).json({ error: 'Colors must be hex values like #1a4d3e.' })
    }

    let slug = slugify(academyName) || `coach-${Date.now()}`
    const slugTaken = await db.execute({
      sql: 'SELECT id FROM tenants WHERE slug = ?',
      args: [slug],
    })
    if (slugTaken.rows[0]) {
      slug = `${slug}-${crypto.randomUUID().slice(0, 6)}`
    }

    const usernames = [adminUsername]
    if (parentUsername) usernames.push(parentUsername)
    for (const name of usernames) {
      const taken = await db.execute({
        sql: 'SELECT id FROM users WHERE username = ?',
        args: [name],
      })
      if (taken.rows[0]) {
        return res.status(400).json({ error: `Username "${name}" is already taken.` })
      }
    }

    if (parentUsername) {
      if (parentUsername.length < 3) {
        return res.status(400).json({ error: 'Parent username must be at least 3 characters.' })
      }
      if (!parentPassword || parentPassword.length < 6) {
        return res.status(400).json({ error: 'Parent password must be at least 6 characters.' })
      }
    }

    const tenantId = crypto.randomUUID()
    const createdAt = new Date().toISOString()
    const adminId = crypto.randomUUID()

    const statements = [
      {
        sql: `INSERT INTO tenants (
                id, name, slug, display_name, logo_url,
                primary_color, accent_color, created_at
              ) VALUES (?, ?, ?, ?, '', ?, ?, ?)`,
        args: [
          tenantId,
          academyName,
          slug,
          academyName,
          primaryColor,
          accentColor,
          createdAt,
        ],
      },
      {
        sql: `INSERT INTO users (id, username, password_hash, role, tenant_id, is_owner, created_at)
              VALUES (?, ?, ?, 'admin', ?, 0, ?)`,
        args: [adminId, adminUsername, hashPassword(adminPassword), tenantId, createdAt],
      },
    ]

    let parentId = null
    if (parentUsername) {
      parentId = crypto.randomUUID()
      statements.push({
        sql: `INSERT INTO users (id, username, password_hash, role, tenant_id, is_owner, created_at)
              VALUES (?, ?, ?, 'parent', ?, 0, ?)`,
        args: [parentId, parentUsername, hashPassword(parentPassword), tenantId, createdAt],
      })
    }

    await db.batch(statements, 'write')

    res.status(201).json({
      tenant: await getTenantById(tenantId),
      coach: { id: adminId, username: adminUsername, role: 'admin' },
      parent: parentId
        ? { id: parentId, username: parentUsername, role: 'parent' }
        : null,
    })
  } catch (error) {
    next(error)
  }
})

app.delete('/api/tenant/users/:id', requireAuth, requireOwner, async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own account.' })
    }

    const result = await db.execute({
      sql: `DELETE FROM users
            WHERE id = ? AND tenant_id = ? AND role = 'parent'`,
      args: [req.params.id, req.user.tenantId],
    })
    if ((result.rowsAffected ?? 0) === 0) {
      return res.status(404).json({ error: 'Parent account not found in your CRM.' })
    }
    res.status(204).end()
  } catch (error) {
    next(error)
  }
})

app.get('/api/students', requireAuth, async (req, res, next) => {
  try {
    const result = await db.execute({
      sql: 'SELECT * FROM students WHERE tenant_id = ? ORDER BY created_at DESC',
      args: [req.user.tenantId],
    })
    const students = await Promise.all(result.rows.map((row) => mapStudent(row)))
    res.json(students)
  } catch (error) {
    next(error)
  }
})

app.post('/api/students', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const parsed = parseStudentBody(req.body)
    if (parsed.error) {
      return res.status(400).json({ error: parsed.error })
    }

    const id = crypto.randomUUID()
    const createdAt = new Date().toISOString()

    await db.execute({
      sql: `INSERT INTO students (
              id, name, age, payment_date, number_of_classes,
              fees_per_class, batch, total_fees, amount_paid, category, tenant_id, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        parsed.name,
        parsed.age,
        parsed.paymentDate,
        parsed.numberOfClasses,
        parsed.feesPerClass,
        parsed.batch,
        parsed.totalFees,
        parsed.amountPaid,
        parsed.category,
        req.user.tenantId,
        createdAt,
      ],
    })

    const row = await getStudentRow(id, req.user.tenantId)
    res.status(201).json(await mapStudent(row))
  } catch (error) {
    next(error)
  }
})

app.put('/api/students/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const existing = await getStudentRow(req.params.id, req.user.tenantId)
    if (!existing) {
      return res.status(404).json({ error: 'Student not found.' })
    }

    const parsed = parseStudentBody(req.body)
    if (parsed.error) {
      return res.status(400).json({ error: parsed.error })
    }

    await db.execute({
      sql: `UPDATE students
             SET name = ?, age = ?, payment_date = ?, number_of_classes = ?,
                 fees_per_class = ?, batch = ?, total_fees = ?, amount_paid = ?,
                 category = ?
             WHERE id = ? AND tenant_id = ?`,
      args: [
        parsed.name,
        parsed.age,
        parsed.paymentDate,
        parsed.numberOfClasses,
        parsed.feesPerClass,
        parsed.batch,
        parsed.totalFees,
        parsed.amountPaid,
        parsed.category,
        req.params.id,
        req.user.tenantId,
      ],
    })

    const row = await getStudentRow(req.params.id, req.user.tenantId)
    res.json(await mapStudent(row))
  } catch (error) {
    next(error)
  }
})

app.delete('/api/students/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const result = await db.execute({
      sql: 'DELETE FROM students WHERE id = ? AND tenant_id = ?',
      args: [req.params.id, req.user.tenantId],
    })

    if ((result.rowsAffected ?? 0) === 0) {
      return res.status(404).json({ error: 'Student not found.' })
    }

    res.status(204).end()
  } catch (error) {
    next(error)
  }
})

app.put('/api/students/:id/attendance', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const student = await getStudentRow(req.params.id, req.user.tenantId)
    if (!student) {
      return res.status(404).json({ error: 'Student not found.' })
    }

    const date = String(req.body?.date ?? '')
    const status = req.body?.status == null ? null : String(req.body.status)

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Valid date is required (YYYY-MM-DD).' })
    }
    if (status !== null && !['present', 'absent', 'late'].includes(status)) {
      return res
        .status(400)
        .json({ error: 'Status must be present, absent, late, or cleared.' })
    }

    const existing = await db.execute({
      sql: 'SELECT id FROM attendance WHERE student_id = ? AND date = ?',
      args: [req.params.id, date],
    })

    if (status === null) {
      if (existing.rows[0]) {
        await db.execute({
          sql: 'DELETE FROM attendance WHERE id = ?',
          args: [existing.rows[0].id],
        })
      }
    } else if (existing.rows[0]) {
      await db.execute({
        sql: 'UPDATE attendance SET status = ? WHERE id = ?',
        args: [status, existing.rows[0].id],
      })
    } else {
      await db.execute({
        sql: `INSERT INTO attendance (id, student_id, date, status)
              VALUES (?, ?, ?, ?)`,
        args: [crypto.randomUUID(), req.params.id, date, status],
      })
    }

    const row = await getStudentRow(req.params.id, req.user.tenantId)
    res.json(await mapStudent(row))
  } catch (error) {
    next(error)
  }
})

app.put('/api/attendance/bulk', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const date = String(req.body?.date ?? '')
    const status = String(req.body?.status ?? '')

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Valid date is required (YYYY-MM-DD).' })
    }
    if (!['present', 'absent', 'late'].includes(status)) {
      return res
        .status(400)
        .json({ error: 'Status must be present, absent, or late.' })
    }

    const students = await db.execute({
      sql: 'SELECT id FROM students WHERE tenant_id = ?',
      args: [req.user.tenantId],
    })
    const statements = []

    for (const student of students.rows) {
      const existing = await db.execute({
        sql: 'SELECT id FROM attendance WHERE student_id = ? AND date = ?',
        args: [student.id, date],
      })

      if (existing.rows[0]) {
        statements.push({
          sql: 'UPDATE attendance SET status = ? WHERE id = ?',
          args: [status, existing.rows[0].id],
        })
      } else {
        statements.push({
          sql: `INSERT INTO attendance (id, student_id, date, status)
                VALUES (?, ?, ?, ?)`,
          args: [crypto.randomUUID(), student.id, date, status],
        })
      }
    }

    if (statements.length > 0) {
      await db.batch(statements, 'write')
    }

    const result = await db.execute({
      sql: 'SELECT * FROM students WHERE tenant_id = ? ORDER BY created_at DESC',
      args: [req.user.tenantId],
    })
    const mapped = await Promise.all(result.rows.map((row) => mapStudent(row)))
    res.json(mapped)
  } catch (error) {
    next(error)
  }
})

app.post('/api/students/:id/payments', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const student = await getStudentRow(req.params.id, req.user.tenantId)
    if (!student) {
      return res.status(404).json({ error: 'Student not found.' })
    }

    const amount = Number(req.body?.amount)
    const date = String(req.body?.date ?? '')
    const note = String(req.body?.note ?? '').trim()
    const isRenewal = Boolean(req.body?.isRenewal)

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Enter a valid payment amount.' })
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Valid date is required (YYYY-MM-DD).' })
    }

    const attendance = await db.execute({
      sql: `SELECT status FROM attendance WHERE student_id = ?`,
      args: [req.params.id],
    })
    const classesHeld = countClassesHeld(attendance.rows)
    const cycleStart = student.cycle_start_classes ?? 0
    const sessionsInCycle = Math.max(0, classesHeld - cycleStart)

    const paymentId = crypto.randomUUID()
    await db.execute({
      sql: `INSERT INTO payments (id, student_id, amount, date, note, is_renewal)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [paymentId, req.params.id, amount, date, note, isRenewal ? 1 : 0],
    })

    if (isRenewal) {
      await db.execute({
        sql: `INSERT INTO renewals (
                id, student_id, payment_id, amount, date, note,
                classes_at_renewal, sessions_in_cycle, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          crypto.randomUUID(),
          req.params.id,
          paymentId,
          amount,
          date,
          note,
          classesHeld,
          sessionsInCycle,
          new Date().toISOString(),
        ],
      })
      await db.execute({
        sql: 'UPDATE students SET cycle_start_classes = ? WHERE id = ?',
        args: [classesHeld, req.params.id],
      })
    }

    const row = await getStudentRow(req.params.id, req.user.tenantId)
    res.status(201).json(await mapStudent(row))
  } catch (error) {
    next(error)
  }
})

app.delete('/api/payments/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const payment = await db.execute({
      sql: `SELECT p.student_id
            FROM payments p
            JOIN students s ON s.id = p.student_id
            WHERE p.id = ? AND s.tenant_id = ?`,
      args: [req.params.id, req.user.tenantId],
    })

    if (!payment.rows[0]) {
      return res.status(404).json({ error: 'Payment not found.' })
    }

    await db.execute({
      sql: 'DELETE FROM payments WHERE id = ?',
      args: [req.params.id],
    })

    const row = await getStudentRow(payment.rows[0].student_id, req.user.tenantId)
    res.json(await mapStudent(row))
  } catch (error) {
    next(error)
  }
})

function playerNameMap(players) {
  return new Map(players.map((p) => [p.id, p.name]))
}

async function loadTournament(id, tenantId) {
  const tournamentResult = await db.execute({
    sql: 'SELECT * FROM tournaments WHERE id = ? AND tenant_id = ?',
    args: [id, tenantId],
  })
  const row = tournamentResult.rows[0]
  if (!row) return null

  const playersResult = await db.execute({
    sql: `SELECT id, tournament_id, student_id, name, category
          FROM tournament_players
          WHERE tournament_id = ?
          ORDER BY name`,
    args: [id],
  })
  const players = playersResult.rows.map((p) => ({
    id: p.id,
    tournamentId: p.tournament_id,
    studentId: p.student_id,
    name: p.name,
    category: p.category || 'open',
  }))
  const names = playerNameMap(players)

  const pairingsResult = await db.execute({
    sql: `SELECT id, tournament_id, round, board, white_id, black_id, result
          FROM tournament_pairings
          WHERE tournament_id = ?
          ORDER BY round, board`,
    args: [id],
  })
  const pairings = pairingsResult.rows.map((p) => ({
    id: p.id,
    tournamentId: p.tournament_id,
    round: p.round,
    board: p.board,
    whiteId: p.white_id,
    blackId: p.black_id,
    whiteName: names.get(p.white_id) ?? 'Unknown',
    blackName: p.black_id ? (names.get(p.black_id) ?? 'Unknown') : null,
    result: p.result,
  }))

  const categoryById = new Map(players.map((p) => [p.id, p.category]))
  const standings = computeStandings(
    players.map((p) => ({ id: p.id, name: p.name })),
    pairings,
  ).map((s) => ({
    id: s.id,
    name: s.name,
    category: categoryById.get(s.id) || 'open',
    points: s.points,
    wins: s.wins,
    draws: s.draws,
    losses: s.losses,
    buchholz: s.buchholz,
    hadBye: s.hadBye,
  }))

  const categoryWinners = {
    u10: standings.filter((s) => s.category === 'u10').slice(0, 3),
    u15: standings.filter((s) => s.category === 'u15').slice(0, 3),
    open: standings.filter((s) => s.category === 'open').slice(0, 3),
  }

  return {
    id: row.id,
    name: row.name,
    category: row.category,
    rounds: row.rounds,
    currentRound: row.current_round,
    status: row.status,
    createdAt: row.created_at,
    players,
    pairings,
    standings,
    categoryWinners,
  }
}

app.get('/api/tournaments', requireAuth, async (req, res, next) => {
  try {
    const result = await db.execute({
      sql: 'SELECT * FROM tournaments WHERE tenant_id = ? ORDER BY created_at DESC',
      args: [req.user.tenantId],
    })
    const tournaments = await Promise.all(
      result.rows.map((row) => loadTournament(row.id, req.user.tenantId)),
    )
    res.json(tournaments)
  } catch (error) {
    next(error)
  }
})

app.post('/api/tournaments', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const name = String(req.body?.name ?? '').trim()
    if (!name) {
      return res.status(400).json({ error: 'Tournament name is required.' })
    }

    const id = crypto.randomUUID()
    await db.execute({
      sql: `INSERT INTO tournaments (id, name, category, rounds, current_round, status, tenant_id, created_at)
            VALUES (?, ?, 'open', 0, 0, 'setup', ?, ?)`,
      args: [id, name, req.user.tenantId, new Date().toISOString()],
    })
    res.status(201).json(await loadTournament(id, req.user.tenantId))
  } catch (error) {
    next(error)
  }
})

app.delete('/api/tournaments/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const result = await db.execute({
      sql: 'DELETE FROM tournaments WHERE id = ? AND tenant_id = ?',
      args: [req.params.id, req.user.tenantId],
    })
    if ((result.rowsAffected ?? 0) === 0) {
      return res.status(404).json({ error: 'Tournament not found.' })
    }
    res.status(204).end()
  } catch (error) {
    next(error)
  }
})

app.post('/api/tournaments/:id/players', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const tournament = await loadTournament(req.params.id, req.user.tenantId)
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found.' })
    }
    if (tournament.status !== 'setup') {
      return res.status(400).json({ error: 'Players can only be added before pairings start.' })
    }

    const studentId = req.body?.studentId ? String(req.body.studentId) : null
    let name = String(req.body?.name ?? '').trim()
    let category = String(req.body?.category ?? '').trim()

    if (studentId) {
      const student = await getStudentRow(studentId, req.user.tenantId)
      if (!student) {
        return res.status(404).json({ error: 'Student not found.' })
      }
      name = student.name
      if (!category) category = student.category || 'open'
      const already = tournament.players.some((p) => p.studentId === studentId)
      if (already) {
        return res.status(400).json({ error: 'This student is already in the tournament.' })
      }
    }

    if (!name) {
      return res.status(400).json({ error: 'Player name is required.' })
    }
    if (!CATEGORIES.has(category)) {
      return res.status(400).json({ error: 'Select a category: U-10, U-15, or Open.' })
    }

    await db.execute({
      sql: `INSERT INTO tournament_players (id, tournament_id, student_id, name, category)
            VALUES (?, ?, ?, ?, ?)`,
      args: [crypto.randomUUID(), req.params.id, studentId, name, category],
    })
    res.status(201).json(await loadTournament(req.params.id, req.user.tenantId))
  } catch (error) {
    next(error)
  }
})

app.delete('/api/tournaments/:id/players/:playerId', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const tournament = await loadTournament(req.params.id, req.user.tenantId)
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found.' })
    }
    if (tournament.status !== 'setup') {
      return res.status(400).json({ error: 'Players can only be removed before pairings start.' })
    }

    await db.execute({
      sql: 'DELETE FROM tournament_players WHERE id = ? AND tournament_id = ?',
      args: [req.params.playerId, req.params.id],
    })
    res.json(await loadTournament(req.params.id, req.user.tenantId))
  } catch (error) {
    next(error)
  }
})

app.post('/api/tournaments/:id/pair', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const tournament = await loadTournament(req.params.id, req.user.tenantId)
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found.' })
    }
    if (tournament.players.length < 2) {
      return res.status(400).json({ error: 'Add at least 2 players before pairing.' })
    }

    const requestedRounds = Number(req.body?.rounds)
    if (tournament.status === 'setup') {
      if (!Number.isInteger(requestedRounds) || requestedRounds < 1 || requestedRounds > 15) {
        return res.status(400).json({ error: 'Enter a valid number of rounds (1–15).' })
      }
    }

    if (tournament.status === 'completed') {
      return res.status(400).json({ error: 'This tournament is already completed.' })
    }

    if (tournament.currentRound > 0) {
      const currentGames = tournament.pairings.filter(
        (p) => p.round === tournament.currentRound,
      )
      const unfinished = currentGames.some((p) => !p.result)
      if (unfinished) {
        return res.status(400).json({ error: 'Enter all results for the current round first.' })
      }
    }

    const nextRound = tournament.currentRound + 1
    const totalRounds =
      tournament.status === 'setup' ? requestedRounds : tournament.rounds

    if (nextRound > totalRounds) {
      return res.status(400).json({ error: 'All rounds have already been paired.' })
    }

    const standings = computeStandings(
      tournament.players.map((p) => ({ id: p.id, name: p.name })),
      tournament.pairings,
    )

    const boards = makeSwissPairings(
      standings,
      tournament.pairings,
      nextRound,
    )

    for (const board of boards) {
      await db.execute({
        sql: `INSERT INTO tournament_pairings
              (id, tournament_id, round, board, white_id, black_id, result)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          crypto.randomUUID(),
          req.params.id,
          nextRound,
          board.board,
          board.whiteId,
          board.blackId,
          board.result,
        ],
      })
    }

    const finished = nextRound >= totalRounds
    await db.execute({
      sql: `UPDATE tournaments
            SET rounds = ?, current_round = ?, status = ?
            WHERE id = ?`,
      args: [
        totalRounds,
        nextRound,
        finished && boards.every((b) => b.result) ? 'completed' : 'in_progress',
        req.params.id,
      ],
    })

    res.json(await loadTournament(req.params.id, req.user.tenantId))
  } catch (error) {
    next(error)
  }
})

app.put('/api/tournaments/:id/pairings/:pairingId', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const tournament = await loadTournament(req.params.id, req.user.tenantId)
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found.' })
    }

    const pairing = tournament.pairings.find((p) => p.id === req.params.pairingId)
    if (!pairing) {
      return res.status(404).json({ error: 'Pairing not found.' })
    }
    if (pairing.result === 'bye') {
      return res.status(400).json({ error: 'Bye results cannot be changed.' })
    }

    const result = String(req.body?.result ?? '')
    if (!['1-0', '0-1', '1/2-1/2'].includes(result)) {
      return res.status(400).json({ error: 'Result must be 1-0, 0-1, or 1/2-1/2.' })
    }

    await db.execute({
      sql: 'UPDATE tournament_pairings SET result = ? WHERE id = ?',
      args: [result, req.params.pairingId],
    })

    const updated = await loadTournament(req.params.id, req.user.tenantId)
    const lastRoundDone =
      updated.currentRound >= updated.rounds &&
      updated.pairings
        .filter((p) => p.round === updated.currentRound)
        .every((p) => p.result)

    if (lastRoundDone && updated.status !== 'completed') {
      await db.execute({
        sql: `UPDATE tournaments SET status = 'completed' WHERE id = ?`,
        args: [req.params.id],
      })
      res.json(await loadTournament(req.params.id, req.user.tenantId))
      return
    }

    res.json(updated)
  } catch (error) {
    next(error)
  }
})

app.use((error, _req, res, _next) => {
  console.error(error)
  res.status(500).json({
    error:
      error instanceof Error
        ? error.message
        : 'Unexpected server error. Check database configuration.',
  })
})

export default app

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Student CRM API running on http://localhost:${PORT}`)
    console.log(
      process.env.TURSO_DATABASE_URL
        ? 'Using Turso remote database'
        : 'Using local SQLite file (server/data/student-crm.db)',
    )
  })
}
