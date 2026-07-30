import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { balanceDue, totalPaid } from '../hooks/useStudents'
import type { Student } from '../types'

interface FeesViewProps {
  students: Student[]
  onAddPayment: (
    studentId: string,
    amount: number,
    date: string,
    note: string,
  ) => Promise<unknown>
  onDeletePayment: (studentId: string, paymentId: string) => Promise<unknown>
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export function FeesView({
  students,
  onAddPayment,
  onDeletePayment,
}: FeesViewProps) {
  const [studentId, setStudentId] = useState(students[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!students.some((s) => s.id === studentId)) {
      setStudentId(students[0]?.id ?? '')
    }
  }, [students, studentId])

  const selected = useMemo(
    () => students.find((s) => s.id === studentId) ?? null,
    [students, studentId],
  )

  const allPayments = useMemo(
    () =>
      students
        .flatMap((s) =>
          s.payments.map((p) => ({
            ...p,
            studentId: s.id,
            studentName: s.name,
          })),
        )
        .sort((a, b) => b.date.localeCompare(a.date)),
    [students],
  )

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (!studentId) {
      setError('Select a student.')
      return
    }
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter the amount paid.')
      return
    }

    try {
      setSaving(true)
      await onAddPayment(studentId, value, date, note)
      setAmount('')
      setNote('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save payment.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="panel">
      <header className="panel-header">
        <div>
          <h1>Fees</h1>
          <p className="muted">
            Record only amounts students actually paid. No sample fees are stored.
          </p>
        </div>
      </header>

      <div className="fees-layout">
        <form className="form-card" onSubmit={handleSubmit}>
          <h2>Record payment</h2>
          <label>
            Student
            <select
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              disabled={students.length === 0}
            >
              {students.length === 0 ? (
                <option value="">Add a student first</option>
              ) : (
                students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))
              )}
            </select>
          </label>

          {selected ? (
            <div className="fee-summary">
              <div>
                <span className="muted">Total fees</span>
                <strong>₹{selected.totalFees.toLocaleString('en-IN')}</strong>
              </div>
              <div>
                <span className="muted">Paid</span>
                <strong>₹{totalPaid(selected).toLocaleString('en-IN')}</strong>
              </div>
              <div>
                <span className="muted">Balance</span>
                <strong
                  className={balanceDue(selected) > 0 ? 'text-warn' : 'text-ok'}
                >
                  ₹{balanceDue(selected).toLocaleString('en-IN')}
                </strong>
              </div>
            </div>
          ) : null}
          {selected ? (
            <p className="muted compact">
              {selected.numberOfClasses} classes × ₹
              {selected.feesPerClass.toLocaleString('en-IN')} · Payment date{' '}
              {selected.paymentDate || '—'}
            </p>
          ) : null}

          <div className="form-row two-col">
            <label>
              Amount paid (₹)
              <input
                type="number"
                min={1}
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount paid"
                required
              />
            </label>
            <label>
              Date
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </label>
          </div>
          <label>
            Note
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note"
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <div className="form-actions">
            <button
              type="submit"
              className="btn primary"
              disabled={students.length === 0 || saving}
            >
              {saving ? 'Saving…' : 'Save payment'}
            </button>
          </div>
        </form>

        <div className="table-wrap fees-table">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Student</th>
                <th>Amount</th>
                <th>Note</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {allPayments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-cell">
                    No payments in the database yet.
                  </td>
                </tr>
              ) : (
                allPayments.map((p) => (
                  <tr key={p.id}>
                    <td>{p.date}</td>
                    <td className="name-cell">{p.studentName}</td>
                    <td>₹{p.amount.toLocaleString('en-IN')}</td>
                    <td>{p.note || '—'}</td>
                    <td className="row-actions">
                      <button
                        type="button"
                        className="btn small danger"
                        onClick={async () => {
                          try {
                            await onDeletePayment(p.studentId, p.id)
                          } catch (err) {
                            alert(
                              err instanceof Error
                                ? err.message
                                : 'Could not delete payment.',
                            )
                          }
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
