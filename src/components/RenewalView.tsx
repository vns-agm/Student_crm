import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  cycleLimit,
  isRenewalPending,
  renewalCount,
  sessionsInCycle,
  totalPaid,
} from '../hooks/useStudents'
import { BATCH_OPTIONS } from '../types'
import type { Batch, Student, TenantBranding } from '../types'
import { useToast } from './ToastProvider'
import { downloadPaymentReceipt } from '../utils/receipt'

interface RenewalViewProps {
  students: Student[]
  branding?: TenantBranding | null
  onRecordRenewal: (
    studentId: string,
    amount: number,
    date: string,
    note: string,
  ) => Promise<Student>
  onGoFees: () => void
}

function batchLabel(batch: Batch) {
  return BATCH_OPTIONS.find((o) => o.value === batch)?.label ?? batch
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function RenewalView({
  students,
  branding,
  onRecordRenewal,
  onGoFees,
}: RenewalViewProps) {
  const { showToast } = useToast()
  const [selectedId, setSelectedId] = useState(students[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const pending = useMemo(
    () => students.filter((s) => isRenewalPending(s)),
    [students],
  )

  const selected = useMemo(
    () => students.find((s) => s.id === selectedId) ?? null,
    [students, selectedId],
  )

  async function handleRenewal(e: FormEvent) {
    e.preventDefault()
    if (!selected) return
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) {
      showToast('Enter a valid renewal amount.', 'error')
      return
    }
    try {
      setSaving(true)
      const updated = await onRecordRenewal(selected.id, value, date, note)
      const payment = updated.payments[0]
      if (payment) {
        await downloadPaymentReceipt({
          student: updated,
          payment,
          branding,
          renewalNumber: updated.renewalCount,
          isRenewal: true,
        })
      }
      setAmount('')
      setNote('')
      showToast('Renewal recorded and receipt downloaded', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not record renewal.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="panel">
      <header className="panel-header">
        <div>
          <h1>Renewal</h1>
          <p className="muted">
            Renewal is pending once a student completes their enrolled package
            (e.g. 4 or 8 classes). Record payment and download a branded receipt.
          </p>
        </div>
        <button type="button" className="btn ghost" onClick={onGoFees}>
          All payments
        </button>
      </header>

      <div className="stat-grid parent-stats">
        <article className="stat-card">
          <p className="stat-label">Renewal pending</p>
          <p className="stat-value accent">{pending.length}</p>
          <p className="stat-sub muted">Students who finished their package</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Total renewals</p>
          <p className="stat-value">
            {students.reduce((sum, s) => sum + renewalCount(s), 0)}
          </p>
          <p className="stat-sub muted">Across all students</p>
        </article>
      </div>

      <div className="fees-layout">
        <form className="form-card" onSubmit={handleRenewal}>
          <h2>Record renewal</h2>
          <label>
            Student
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              disabled={students.length === 0}
            >
              {students.length === 0 ? (
                <option value="">No students</option>
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
                <span className="muted">Sessions this cycle</span>
                <strong>
                  {sessionsInCycle(selected)}/{cycleLimit(selected)}
                </strong>
              </div>
              <div>
                <span className="muted">Times renewed</span>
                <strong>{renewalCount(selected)}</strong>
              </div>
              <div>
                <span className="muted">Total paid</span>
                <strong>₹{totalPaid(selected).toLocaleString('en-IN')}</strong>
              </div>
            </div>
          ) : null}

          <div className="form-row two-col">
            <label>
              Renewal amount (₹)
              <input
                type="number"
                min={1}
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={selected ? String(selected.totalFees) : 'Amount'}
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
              placeholder="e.g. 8-class renewal"
            />
          </label>
          <div className="form-actions">
            <button
              type="submit"
              className="btn primary"
              disabled={students.length === 0 || saving}
            >
              {saving ? 'Saving…' : 'Record renewal & download receipt'}
            </button>
          </div>
        </form>

        <div className="form-card">
          <h2>Renewal history</h2>
          {selected && selected.renewals.length > 0 ? (
            <ul className="class-date-list">
              {selected.renewals.map((r, index) => (
                <li key={r.id}>
                  <span>
                    <span className="name-cell">
                      #{selected.renewals.length - index} · {formatDate(r.date)}
                    </span>
                    <span className="muted compact">
                      {r.sessionsInCycle} sessions · after{' '}
                      {r.classesAtRenewal} classes held
                    </span>
                  </span>
                  <strong>₹{r.amount.toLocaleString('en-IN')}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No renewals recorded for this student yet.</p>
          )}
        </div>
      </div>

      <div className="table-wrap" style={{ marginTop: '1.25rem' }}>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Batch</th>
              <th>Sessions (cycle)</th>
              <th>Renewals</th>
              <th>Last renewal</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {students.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty-cell">
                  No students yet.
                </td>
              </tr>
            ) : (
              students.map((s) => {
                const last = s.renewals[0]
                return (
                  <tr key={s.id}>
                    <td className="name-cell">{s.name}</td>
                    <td>
                      <span className="pill">{batchLabel(s.batch)}</span>
                    </td>
                    <td>
                      {sessionsInCycle(s)}/{cycleLimit(s)}
                    </td>
                    <td>{renewalCount(s)}</td>
                    <td>{last ? formatDate(last.date) : '—'}</td>
                    <td>
                      {isRenewalPending(s) ? (
                        <span className="pill renewal-pending">Renewal pending</span>
                      ) : (
                        <span className="pill">Active</span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
