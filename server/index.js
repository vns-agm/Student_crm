import cors from 'cors'
import express from 'express'
import db from './db.js'

const app = express()
const PORT = process.env.PORT || 3001
const BATCHES = new Set(['beginner', 'intermediate', 'advanced'])

app.use(cors())
app.use(express.json())

function mapStudent(row) {
  const attendance = db
    .prepare(
      `SELECT id, date, status
       FROM attendance
       WHERE student_id = ?
       ORDER BY date DESC`,
    )
    .all(row.id)

  const payments = db
    .prepare(
      `SELECT id, amount, date, note
       FROM payments
       WHERE student_id = ?
       ORDER BY date DESC, rowid DESC`,
    )
    .all(row.id)

  return {
    id: row.id,
    name: row.name,
    age: row.age,
    paymentDate: row.payment_date,
    numberOfClasses: row.number_of_classes,
    feesPerClass: row.fees_per_class,
    batch: row.batch,
    totalFees: row.total_fees,
    amountPaid: row.amount_paid,
    createdAt: row.created_at,
    attendance,
    payments,
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

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/students', (_req, res) => {
  const rows = db
    .prepare('SELECT * FROM students ORDER BY created_at DESC')
    .all()
  res.json(rows.map(mapStudent))
})

app.post('/api/students', (req, res) => {
  const parsed = parseStudentBody(req.body)
  if (parsed.error) {
    return res.status(400).json({ error: parsed.error })
  }

  const student = {
    id: crypto.randomUUID(),
    name: parsed.name,
    age: parsed.age,
    payment_date: parsed.paymentDate,
    number_of_classes: parsed.numberOfClasses,
    fees_per_class: parsed.feesPerClass,
    batch: parsed.batch,
    total_fees: parsed.totalFees,
    amount_paid: parsed.amountPaid,
    created_at: new Date().toISOString(),
  }

  db.prepare(
    `INSERT INTO students (
      id, name, age, payment_date, number_of_classes,
      fees_per_class, batch, total_fees, amount_paid, created_at
    ) VALUES (
      @id, @name, @age, @payment_date, @number_of_classes,
      @fees_per_class, @batch, @total_fees, @amount_paid, @created_at
    )`,
  ).run(student)

  res.status(201).json(mapStudent(student))
})

app.put('/api/students/:id', (req, res) => {
  const existing = db
    .prepare('SELECT * FROM students WHERE id = ?')
    .get(req.params.id)

  if (!existing) {
    return res.status(404).json({ error: 'Student not found.' })
  }

  const parsed = parseStudentBody(req.body)
  if (parsed.error) {
    return res.status(400).json({ error: parsed.error })
  }

  db.prepare(
    `UPDATE students
     SET name = ?, age = ?, payment_date = ?, number_of_classes = ?,
         fees_per_class = ?, batch = ?, total_fees = ?, amount_paid = ?
     WHERE id = ?`,
  ).run(
    parsed.name,
    parsed.age,
    parsed.paymentDate,
    parsed.numberOfClasses,
    parsed.feesPerClass,
    parsed.batch,
    parsed.totalFees,
    parsed.amountPaid,
    req.params.id,
  )

  const updated = db
    .prepare('SELECT * FROM students WHERE id = ?')
    .get(req.params.id)

  res.json(mapStudent(updated))
})

app.delete('/api/students/:id', (req, res) => {
  const result = db.prepare('DELETE FROM students WHERE id = ?').run(req.params.id)
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Student not found.' })
  }
  res.status(204).end()
})

app.put('/api/students/:id/attendance', (req, res) => {
  const student = db
    .prepare('SELECT id FROM students WHERE id = ?')
    .get(req.params.id)

  if (!student) {
    return res.status(404).json({ error: 'Student not found.' })
  }

  const date = String(req.body?.date ?? '')
  const status = String(req.body?.status ?? '')

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Valid date is required (YYYY-MM-DD).' })
  }
  if (!['present', 'absent', 'late'].includes(status)) {
    return res.status(400).json({ error: 'Status must be present, absent, or late.' })
  }

  const existing = db
    .prepare(
      'SELECT id FROM attendance WHERE student_id = ? AND date = ?',
    )
    .get(req.params.id, date)

  if (existing) {
    db.prepare('UPDATE attendance SET status = ? WHERE id = ?').run(
      status,
      existing.id,
    )
  } else {
    db.prepare(
      `INSERT INTO attendance (id, student_id, date, status)
       VALUES (?, ?, ?, ?)`,
    ).run(crypto.randomUUID(), req.params.id, date, status)
  }

  const row = db
    .prepare('SELECT * FROM students WHERE id = ?')
    .get(req.params.id)

  res.json(mapStudent(row))
})

app.put('/api/attendance/bulk', (req, res) => {
  const date = String(req.body?.date ?? '')
  const status = String(req.body?.status ?? '')

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Valid date is required (YYYY-MM-DD).' })
  }
  if (!['present', 'absent', 'late'].includes(status)) {
    return res.status(400).json({ error: 'Status must be present, absent, or late.' })
  }

  const students = db.prepare('SELECT id FROM students').all()
  const find = db.prepare(
    'SELECT id FROM attendance WHERE student_id = ? AND date = ?',
  )
  const update = db.prepare('UPDATE attendance SET status = ? WHERE id = ?')
  const insert = db.prepare(
    `INSERT INTO attendance (id, student_id, date, status)
     VALUES (?, ?, ?, ?)`,
  )

  const tx = db.transaction(() => {
    for (const student of students) {
      const existing = find.get(student.id, date)
      if (existing) {
        update.run(status, existing.id)
      } else {
        insert.run(crypto.randomUUID(), student.id, date, status)
      }
    }
  })

  tx()

  const rows = db
    .prepare('SELECT * FROM students ORDER BY created_at DESC')
    .all()
  res.json(rows.map(mapStudent))
})

app.post('/api/students/:id/payments', (req, res) => {
  const student = db
    .prepare('SELECT id FROM students WHERE id = ?')
    .get(req.params.id)

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

  db.prepare(
    `INSERT INTO payments (id, student_id, amount, date, note)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(crypto.randomUUID(), req.params.id, amount, date, note)

  const row = db
    .prepare('SELECT * FROM students WHERE id = ?')
    .get(req.params.id)

  res.status(201).json(mapStudent(row))
})

app.delete('/api/payments/:id', (req, res) => {
  const payment = db
    .prepare('SELECT student_id FROM payments WHERE id = ?')
    .get(req.params.id)

  if (!payment) {
    return res.status(404).json({ error: 'Payment not found.' })
  }

  db.prepare('DELETE FROM payments WHERE id = ?').run(req.params.id)

  const row = db
    .prepare('SELECT * FROM students WHERE id = ?')
    .get(payment.student_id)

  res.json(mapStudent(row))
})

app.listen(PORT, () => {
  console.log(`Student CRM API running on http://localhost:${PORT}`)
})
