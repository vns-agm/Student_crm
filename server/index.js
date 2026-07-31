import cors from 'cors'
import express from 'express'
import { db, ensureDb } from './db.js'

const app = express()
const PORT = process.env.PORT || 3001
const BATCHES = new Set(['beginner', 'intermediate', 'advanced'])

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
    sql: `SELECT id, amount, date, note
          FROM payments
          WHERE student_id = ?
          ORDER BY date DESC, rowid DESC`,
    args: [row.id],
  })

  return {
    id: row.id,
    name: row.name,
    age: row.age,
    paymentDate: row.payment_date,
    numberOfClasses: row.number_of_classes,
    feesPerClass: row.fees_per_class,
    batch: row.batch,
    totalFees: row.total_fees,
    amountPaid: row.amount_paid ?? 0,
    createdAt: row.created_at,
    attendance: attendance.rows,
    payments: payments.rows,
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
    totalFees,
  }
}

async function getStudentRow(id) {
  const result = await db.execute({
    sql: 'SELECT * FROM students WHERE id = ?',
    args: [id],
  })
  return result.rows[0] ?? null
}

app.get('/api/students', async (_req, res, next) => {
  try {
    const result = await db.execute(
      'SELECT * FROM students ORDER BY created_at DESC',
    )
    const students = await Promise.all(result.rows.map((row) => mapStudent(row)))
    res.json(students)
  } catch (error) {
    next(error)
  }
})

app.post('/api/students', async (req, res, next) => {
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
              fees_per_class, batch, total_fees, amount_paid, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        createdAt,
      ],
    })

    const row = await getStudentRow(id)
    res.status(201).json(await mapStudent(row))
  } catch (error) {
    next(error)
  }
})

app.put('/api/students/:id', async (req, res, next) => {
  try {
    const existing = await getStudentRow(req.params.id)
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
                 fees_per_class = ?, batch = ?, total_fees = ?, amount_paid = ?
             WHERE id = ?`,
      args: [
        parsed.name,
        parsed.age,
        parsed.paymentDate,
        parsed.numberOfClasses,
        parsed.feesPerClass,
        parsed.batch,
        parsed.totalFees,
        parsed.amountPaid,
        req.params.id,
      ],
    })

    const row = await getStudentRow(req.params.id)
    res.json(await mapStudent(row))
  } catch (error) {
    next(error)
  }
})

app.delete('/api/students/:id', async (req, res, next) => {
  try {
    const result = await db.execute({
      sql: 'DELETE FROM students WHERE id = ?',
      args: [req.params.id],
    })

    if ((result.rowsAffected ?? 0) === 0) {
      return res.status(404).json({ error: 'Student not found.' })
    }

    res.status(204).end()
  } catch (error) {
    next(error)
  }
})

app.put('/api/students/:id/attendance', async (req, res, next) => {
  try {
    const student = await getStudentRow(req.params.id)
    if (!student) {
      return res.status(404).json({ error: 'Student not found.' })
    }

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

    const existing = await db.execute({
      sql: 'SELECT id FROM attendance WHERE student_id = ? AND date = ?',
      args: [req.params.id, date],
    })

    if (existing.rows[0]) {
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

    const row = await getStudentRow(req.params.id)
    res.json(await mapStudent(row))
  } catch (error) {
    next(error)
  }
})

app.put('/api/attendance/bulk', async (req, res, next) => {
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

    const students = await db.execute('SELECT id FROM students')
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

    const result = await db.execute(
      'SELECT * FROM students ORDER BY created_at DESC',
    )
    const mapped = await Promise.all(result.rows.map((row) => mapStudent(row)))
    res.json(mapped)
  } catch (error) {
    next(error)
  }
})

app.post('/api/students/:id/payments', async (req, res, next) => {
  try {
    const student = await getStudentRow(req.params.id)
    if (!student) {
      return res.status(404).json({ error: 'Student not found.' })
    }

    const amount = Number(req.body?.amount)
    const date = String(req.body?.date ?? '')
    const note = String(req.body?.note ?? '').trim()

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Enter a valid payment amount.' })
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Valid date is required (YYYY-MM-DD).' })
    }

    await db.execute({
      sql: `INSERT INTO payments (id, student_id, amount, date, note)
            VALUES (?, ?, ?, ?, ?)`,
      args: [crypto.randomUUID(), req.params.id, amount, date, note],
    })

    const row = await getStudentRow(req.params.id)
    res.status(201).json(await mapStudent(row))
  } catch (error) {
    next(error)
  }
})

app.delete('/api/payments/:id', async (req, res, next) => {
  try {
    const payment = await db.execute({
      sql: 'SELECT student_id FROM payments WHERE id = ?',
      args: [req.params.id],
    })

    if (!payment.rows[0]) {
      return res.status(404).json({ error: 'Payment not found.' })
    }

    await db.execute({
      sql: 'DELETE FROM payments WHERE id = ?',
      args: [req.params.id],
    })

    const row = await getStudentRow(payment.rows[0].student_id)
    res.json(await mapStudent(row))
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
