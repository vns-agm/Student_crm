import crypto from 'node:crypto'
import { createDemoSchema, getDemoClient } from './db.js'

export const DEMO_TENANT_ID = '00000000-0000-4000-8000-00000000de30'
const DEMO_USER_ID = 'demo-user'
const RESEED_AFTER_MS = 1000 * 60 * 60 * 6 // 6 hours

// Fictional students: sessions = classes attended so far, package = classes per
// cycle. Anyone past their package gets a renewal, so the demo shows every state.
const STUDENTS = [
  { name: 'Aarav Mehta', age: 8, batch: 'beginner', category: 'u10', package: 8, fee: 500, sessions: 6 },
  { name: 'Diya Kapoor', age: 9, batch: 'beginner', category: 'u10', package: 8, fee: 500, sessions: 8 },
  { name: 'Vivaan Nair', age: 7, batch: 'beginner', category: 'u10', package: 8, fee: 500, sessions: 3 },
  { name: 'Ananya Rao', age: 10, batch: 'intermediate', category: 'u15', package: 12, fee: 600, sessions: 10 },
  { name: 'Kabir Singh', age: 11, batch: 'intermediate', category: 'u15', package: 8, fee: 600, sessions: 11 },
  { name: 'Ishita Verma', age: 12, batch: 'intermediate', category: 'u15', package: 12, fee: 600, sessions: 7, unpaid: true },
  { name: 'Reyansh Gupta', age: 13, batch: 'advanced', category: 'u15', package: 8, fee: 800, sessions: 14 },
  { name: 'Myra Iyer', age: 14, batch: 'advanced', category: 'u15', package: 12, fee: 800, sessions: 5 },
  { name: 'Arjun Malhotra', age: 16, batch: 'advanced', category: 'open', package: 12, fee: 800, sessions: 12 },
  { name: 'Sara Khan', age: 19, batch: 'advanced', category: 'open', package: 8, fee: 800, sessions: 2, unpaid: true },
]

function isoDate(date) {
  return date.toISOString().slice(0, 10)
}

// Recent Wednesday and Saturday class dates, oldest first.
function recentClassDates(count) {
  const dates = []
  const day = new Date()
  while (dates.length < count) {
    if (day.getUTCDay() === 3 || day.getUTCDay() === 6) dates.unshift(isoDate(day))
    day.setUTCDate(day.getUTCDate() - 1)
  }
  return dates
}

function studentStatements(student, index, now) {
  const id = crypto.randomUUID()
  const statements = []
  const absences = Math.floor(student.sessions / 5)
  const dates = recentClassDates(student.sessions + absences)
  const packagePrice = student.package * student.fee
  const firstDate = dates[0]

  let cycle = 1
  let held = 0
  let heldInCycle = 0
  dates.forEach((date, i) => {
    // Every sixth class is missed; a few others are late.
    const missed = (i + index) % 6 === 5 && held + (dates.length - i - 1) >= student.sessions
    const status = missed ? 'absent' : (i + index) % 7 === 3 ? 'late' : 'present'
    if (heldInCycle >= student.package) {
      const paymentId = crypto.randomUUID()
      statements.push(
        {
          sql: `INSERT INTO payments (id, student_id, amount, date, note, is_renewal)
                VALUES (?, ?, ?, ?, ?, 1)`,
          args: [paymentId, id, packagePrice, date, 'Package renewal'],
        },
        {
          sql: `INSERT INTO renewals (
                  id, student_id, payment_id, amount, date, note, classes_at_renewal,
                  sessions_in_cycle, cycle_number, classes_in_package, previous_classes, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            crypto.randomUUID(), id, paymentId, packagePrice, date, 'Package renewal',
            held, heldInCycle, cycle + 1, student.package, student.package, now,
          ],
        },
      )
      cycle += 1
      heldInCycle = 0
    }
    if (status !== 'absent') {
      held += 1
      heldInCycle += 1
    }
    statements.push({
      sql: 'INSERT INTO attendance (id, student_id, date, status, cycle_no) VALUES (?, ?, ?, ?, ?)',
      args: [crypto.randomUUID(), id, date, status, cycle],
    })
  })

  const amountPaid = student.unpaid ? Math.round(packagePrice / 2) : packagePrice
  statements.unshift({
    sql: `INSERT INTO students (
            id, name, age, payment_date, number_of_classes, fees_per_class, batch, total_fees,
            amount_paid, category, tenant_id, created_at, current_cycle, cycle_start_classes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id, student.name, student.age, firstDate, student.package, student.fee, student.batch,
      packagePrice, amountPaid, student.category, DEMO_TENANT_ID, now, cycle, held - heldInCycle,
    ],
  })
  statements.splice(1, 0, {
    sql: `INSERT INTO payments (id, student_id, amount, date, note, is_renewal)
          VALUES (?, ?, ?, ?, ?, 0)`,
    args: [crypto.randomUUID(), id, amountPaid, firstDate, 'Package fee'],
  })
  return { id, statements }
}

function tournamentStatements(students, now) {
  const tournamentId = crypto.randomUUID()
  const players = students.slice(3, 9).map(({ id, student }) => ({
    id: crypto.randomUUID(),
    studentId: id,
    name: student.name,
    category: student.category,
  }))
  const statements = [
    {
      sql: `INSERT INTO tournaments (id, name, category, rounds, current_round, status, tenant_id, created_at)
            VALUES (?, ?, 'open', 3, 1, 'in_progress', ?, ?)`,
      args: [tournamentId, 'Monthly Rapid Championship', DEMO_TENANT_ID, now],
    },
  ]
  for (const player of players) {
    statements.push({
      sql: `INSERT INTO tournament_players (id, tournament_id, student_id, name, category)
            VALUES (?, ?, ?, ?, ?)`,
      args: [player.id, tournamentId, player.studentId, player.name, player.category],
    })
  }
  const results = ['1-0', '1/2-1/2', '0-1']
  for (let board = 0; board < 3; board += 1) {
    statements.push({
      sql: `INSERT INTO tournament_pairings (id, tournament_id, round, board, white_id, black_id, result)
            VALUES (?, ?, 1, ?, ?, ?, ?)`,
      args: [
        crypto.randomUUID(), tournamentId, board + 1,
        players[board].id, players[board + 3].id, results[board],
      ],
    })
  }
  return statements
}

async function reseed(client) {
  const now = new Date().toISOString()
  const students = STUDENTS.map((student, index) => ({
    student,
    ...studentStatements(student, index, now),
  }))

  await client.batch(
    [
      'DELETE FROM tournament_pairings',
      'DELETE FROM tournament_players',
      'DELETE FROM tournaments',
      'DELETE FROM renewals',
      'DELETE FROM payments',
      'DELETE FROM attendance',
      'DELETE FROM students',
      'DELETE FROM users',
      'DELETE FROM tenants',
      {
        sql: `INSERT INTO tenants (id, name, slug, display_name, logo_url, primary_color, accent_color, created_at)
              VALUES (?, ?, ?, ?, '', '#1a4d3e', '#b8892c', ?)`,
        args: [DEMO_TENANT_ID, 'Agam Chess Classes Demo', 'demo', 'Agam Chess Classes (Demo)', now],
      },
      {
        // Reached only through the demo button: this hash matches no password.
        sql: `INSERT INTO users (id, username, password_hash, role, tenant_id, is_owner, created_at)
              VALUES (?, 'demo', '!', 'admin', ?, 0, ?)`,
        args: [DEMO_USER_ID, DEMO_TENANT_ID, now],
      },
      ...students.flatMap((s) => s.statements),
      ...tournamentStatements(students, now),
      {
        sql: `INSERT INTO demo_meta (key, value) VALUES ('seeded_at', ?)
              ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
        args: [now],
      },
    ],
    'write',
  )
}

// Visitors can edit the demo freely, so it goes back to the sample data periodically.
export async function refreshDemoData() {
  const client = getDemoClient()
  await client.execute(
    'CREATE TABLE IF NOT EXISTS demo_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)',
  )
  const seeded = await client.execute(`SELECT value FROM demo_meta WHERE key = 'seeded_at'`)
  const seededAt = Date.parse(seeded.rows[0]?.value ?? '')
  if (!(Date.now() - seededAt < RESEED_AFTER_MS)) {
    // Schema setup is slow over the network, so it only runs with a reset.
    await createDemoSchema()
    await reseed(client)
  }
  const user = await client.execute({
    sql: 'SELECT id, username, role, tenant_id, is_owner FROM users WHERE id = ?',
    args: [DEMO_USER_ID],
  })
  return user.rows[0]
}
