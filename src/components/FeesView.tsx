import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { balanceDue, isRenewalPending, totalPaid } from '../hooks/useStudents'
import type { Student, TenantBranding } from '../types'
import { downloadPaymentReceipt } from '../utils/receipt'
import { useToast } from './ToastProvider'

interface FeesViewProps {
  students: Student[]
  branding?: TenantBranding | null
  onAddPayment: (
    studentId: string,
    amount: number,
    date: string,
    note: string,
    isRenewal?: boolean,
  ) => Promise<Student>
  onDeletePayment: (studentId: string, paymentId: string) => Promise<unknown>
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export function FeesView({
  students,
  branding,
  onAddPayment,
  onDeletePayment,
}: FeesViewProps) {
  const { showToast } = useToast()
  const [studentId, setStudentId] = useState(students[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO)
  const [note, setNote] = useState('')
  const [isRenewal, setIsRenewal] = useState(false)
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

  useEffect(() => {
    if (selected) {
      setIsRenewal(isRenewalPending(selected))
    }
  }, [selected?.id, selected?.sessionsInCycle])

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
      const updated = await onAddPayment(studentId, value, date, note, isRenewal)
      const payment = updated.payments[0]
      if (payment) {
        await downloadPaymentReceipt({
          student: updated,
          payment,
          branding,
          renewalNumber: updated.renewalCount,
          isRenewal,
        })
        showToast('Payment saved — receipt downloaded', 'success')
      }
      setAmount('')
      setNote('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save payment.')
    } finally {
      setSaving(false)
    }
  }

  async function handleReceipt(
    student: Student,
    paymentId: string,
  ) {
    const payment = student.payments.find((p) => p.id === paymentId)
    if (!payment) return
    await downloadPaymentReceipt({
      student,
      payment,
      branding,
      renewalNumber: student.renewalCount,
      isRenewal: payment.isRenewal,
    })
  }

  return (
    <section className="panel">
      <header className="panel-header">
        <div>
          <h1>Fees</h1>
          <p className="muted">
            Record payments and download a branded receipt for your academy.
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
                    {isRenewalPending(s) ? ' · Renewal pending' : ''}
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

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={isRenewal}
              onChange={(e) => setIsRenewal(e.target.checked)}
            />
            <span>
              Mark as renewal (resets the session cycle after payment)
            </span>
          </label>

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
              {saving ? 'Saving…' : 'Save & download receipt'}
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
                allPayments.map((p) => {
                  const student = students.find((s) => s.id === p.studentId)
                  return (
                    <tr key={p.id}>
                      <td>{p.date}</td>
                      <td className="name-cell">
                        {p.studentName}
                        {p.isRenewal ? (
                          <span className="pill renewal-pending" style={{ marginLeft: '0.35rem' }}>
                            Renewal
                          </span>
                        ) : null}
                      </td>
                      <td>₹{p.amount.toLocaleString('en-IN')}</td>
                      <td>{p.note || '—'}</td>
                      <td className="row-actions">
                        {student ? (
                          <button
                            type="button"
                            className="btn small ghost"
                            onClick={() => void handleReceipt(student, p.id)}
                          >
                            Receipt
                          </button>
                        ) : null}
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
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
