import { useEffect, useMemo, useState } from 'react'
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
import { formatDate, initials, todayISO } from '../utils/format'
import { downloadPaymentReceipt } from '../utils/receipt'
import { CycleProgress } from './CycleProgress'
import { useToast } from './ToastProvider'

interface RenewalViewProps {
  students: Student[]
  branding?: TenantBranding | null
  onRecordRenewal: (
    studentId: string,
    amount: number,
    date: string,
    note: string,
    numberOfClasses: number,
  ) => Promise<Student>
  onGoFees: () => void
}

type Filter = 'all' | 'due' | 'active' | 'renewed'

function batchLabel(batch: Batch) {
  return BATCH_OPTIONS.find((o) => o.value === batch)?.label ?? batch
}

export function RenewalView({
  students,
  branding,
  onRecordRenewal,
  onGoFees,
}: RenewalViewProps) {
  const { showToast } = useToast()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(
    () => students.find((s) => isRenewalPending(s))?.id ?? students[0]?.id ?? '',
  )
  const [amount, setAmount] = useState('')
  const [classes, setClasses] = useState('')
  const [date, setDate] = useState(todayISO)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const dueCount = useMemo(
    () => students.filter((s) => isRenewalPending(s)).length,
    [students],
  )
  const totalRenewals = useMemo(
    () => students.reduce((sum, s) => sum + renewalCount(s), 0),
    [students],
  )
  const renewalRevenue = useMemo(
    () =>
      students.reduce(
        (sum, s) => sum + s.renewals.reduce((acc, r) => acc + r.amount, 0),
        0,
      ),
    [students],
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return students
      .filter((s) => !q || s.name.toLowerCase().includes(q))
      .filter((s) => {
        if (filter === 'due') return isRenewalPending(s)
        if (filter === 'active') return !isRenewalPending(s)
        if (filter === 'renewed') return renewalCount(s) > 0
        return true
      })
      .sort((a, b) => Number(isRenewalPending(b)) - Number(isRenewalPending(a)))
  }, [students, query, filter])

  const selected = useMemo(
    () => students.find((s) => s.id === selectedId) ?? null,
    [students, selectedId],
  )

  // Prefill the form with the student's current package whenever they change.
  useEffect(() => {
    if (!selected) return
    setClasses(String(cycleLimit(selected)))
    setAmount(String(cycleLimit(selected) * selected.feesPerClass || ''))
    setNote('')
  }, [selected?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const newClasses = Number(classes)
  const suggestedAmount =
    selected && Number.isInteger(newClasses) && newClasses > 0
      ? newClasses * selected.feesPerClass
      : 0

  async function handleRenewal(e: FormEvent) {
    e.preventDefault()
    if (!selected) return
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) {
      showToast('Enter a valid renewal amount.', 'error')
      return
    }
    if (!Number.isInteger(newClasses) || newClasses < 1) {
      showToast('Enter how many classes the new package includes.', 'error')
      return
    }
    if (
      !isRenewalPending(selected) &&
      !confirm(
        `${selected.name} has only completed ${sessionsInCycle(selected)} of ${cycleLimit(selected)} classes. Renew early anyway? Their class count will restart at 1.`,
      )
    ) {
      return
    }
    try {
      setSaving(true)
      const updated = await onRecordRenewal(
        selected.id,
        value,
        date,
        note || `${newClasses}-class renewal`,
        newClasses,
      )
      const payment = updated.payments.find((p) => p.isRenewal) ?? updated.payments[0]
      if (payment) {
        await downloadPaymentReceipt({
          student: updated,
          payment,
          branding,
          renewalNumber: updated.renewalCount,
          isRenewal: true,
        })
      }
      showToast(
        `${updated.name} renewed (${updated.renewalCount}×). Package #${updated.currentCycle} starts at class 1.`,
        'success',
      )
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not record renewal.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const tabs: { id: Filter; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: students.length },
    { id: 'due', label: 'Renewal due', count: dueCount },
    { id: 'active', label: 'In progress', count: students.length - dueCount },
    {
      id: 'renewed',
      label: 'Renewed before',
      count: students.filter((s) => renewalCount(s) > 0).length,
    },
  ]

  return (
    <section className="panel">
      <header className="panel-header">
        <div>
          <h1>Renewal</h1>
          <p className="muted">
            A renewal starts a new package: the class count restarts at 1 and
            the renewal is added to the student's history.
          </p>
        </div>
        <button type="button" className="btn ghost" onClick={onGoFees}>
          All payments
        </button>
      </header>

      <div className="stat-grid">
        <button
          type="button"
          className={`stat-card stat-btn${filter === 'due' ? ' is-active' : ''}`}
          onClick={() => setFilter(filter === 'due' ? 'all' : 'due')}
        >
          <p className="stat-label">Renewal due</p>
          <p className="stat-value accent">{dueCount}</p>
          <p className="stat-sub muted">Completed their package</p>
        </button>
        <article className="stat-card">
          <p className="stat-label">Total renewals</p>
          <p className="stat-value">{totalRenewals}</p>
          <p className="stat-sub muted">Across all students</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Renewal revenue</p>
          <p className="stat-value">₹{renewalRevenue.toLocaleString('en-IN')}</p>
          <p className="stat-sub muted">From all renewals</p>
        </article>
      </div>

      <div className="renewal-layout">
        <div className="form-card renewal-list-card">
          <input
            className="search"
            type="search"
            placeholder="Search student…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="chip-tabs" role="tablist">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={filter === t.id}
                className={`chip-tab${filter === t.id ? ' is-active' : ''}`}
                onClick={() => setFilter(t.id)}
              >
                {t.label}
                <span className="chip-count">{t.count}</span>
              </button>
            ))}
          </div>
          {visible.length === 0 ? (
            <p className="empty-cell">No students match.</p>
          ) : (
            <ul className="renewal-list">
              {visible.map((s) => {
                const due = isRenewalPending(s)
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      className={`renewal-item${s.id === selectedId ? ' is-selected' : ''}${due ? ' is-due' : ''}`}
                      onClick={() => setSelectedId(s.id)}
                    >
                      <span className="avatar" aria-hidden="true">
                        {initials(s.name)}
                      </span>
                      <span className="renewal-item-body">
                        <span className="renewal-item-top">
                          <span className="name-cell">{s.name}</span>
                          <span className="renew-count" title="Times renewed">
                            ↻ {renewalCount(s)}
                          </span>
                        </span>
                        <CycleProgress student={s} compact />
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {selected ? (
          <div className="renewal-detail">
            <div className="form-card">
              <div className="renewal-head">
                <span className="avatar avatar-lg" aria-hidden="true">
                  {initials(selected.name)}
                </span>
                <div>
                  <h2>{selected.name}</h2>
                  <p className="muted compact">
                    {batchLabel(selected.batch)} · Age {selected.age} · ₹
                    {selected.feesPerClass.toLocaleString('en-IN')}/class
                  </p>
                </div>
                {isRenewalPending(selected) ? (
                  <span className="pill renewal-pending">Renewal due</span>
                ) : (
                  <span className="pill">In progress</span>
                )}
              </div>

              <div className="fee-summary">
                <div>
                  <span className="muted">Times renewed</span>
                  <strong>{renewalCount(selected)}</strong>
                </div>
                <div>
                  <span className="muted">Current package</span>
                  <strong>#{selected.currentCycle}</strong>
                </div>
                <div>
                  <span className="muted">Classes attended (all time)</span>
                  <strong>{selected.classesHeld}</strong>
                </div>
                <div>
                  <span className="muted">Total paid</span>
                  <strong>₹{totalPaid(selected).toLocaleString('en-IN')}</strong>
                </div>
              </div>

              <CycleProgress student={selected} />

              <form className="renewal-form" onSubmit={handleRenewal}>
                <h3 className="modal-subtitle">Record renewal</h3>
                <div className="form-row two-col">
                  <label>
                    Classes in new package
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={classes}
                      onChange={(e) => setClasses(e.target.value)}
                      required
                    />
                  </label>
                  <label>
                    Amount (₹)
                    <input
                      type="number"
                      min={1}
                      step="any"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                    />
                  </label>
                </div>
                {suggestedAmount > 0 && String(suggestedAmount) !== amount ? (
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => setAmount(String(suggestedAmount))}
                  >
                    Use ₹{suggestedAmount.toLocaleString('en-IN')} ({newClasses} × ₹
                    {selected.feesPerClass})
                  </button>
                ) : null}
                <div className="form-row two-col">
                  <label>
                    Date
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                    />
                  </label>
                  <label>
                    Note
                    <input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder={`${newClasses || cycleLimit(selected)}-class renewal`}
                    />
                  </label>
                </div>
                <p className="muted compact">
                  After saving, {selected.name} moves to package #
                  {selected.currentCycle + 1} and the next class is counted as
                  class 1.
                </p>
                <div className="form-actions">
                  <button type="submit" className="btn primary" disabled={saving}>
                    {saving ? 'Saving…' : 'Renew & download receipt'}
                  </button>
                </div>
              </form>
            </div>

            <div className="form-card">
              <h2>Renewal history · {renewalCount(selected)}×</h2>
              <ol className="timeline">
                <li className="timeline-item is-current">
                  <span className="timeline-dot" />
                  <div>
                    <p className="name-cell">
                      Package #{selected.currentCycle} (current)
                    </p>
                    <p className="muted compact">
                      {sessionsInCycle(selected)} of {cycleLimit(selected)} classes
                      attended
                    </p>
                  </div>
                </li>
                {selected.renewals.map((r) => (
                  <li key={r.id} className="timeline-item">
                    <span className="timeline-dot" />
                    <div>
                      <p className="name-cell">
                        Renewal #{r.cycleNumber - 1} · {formatDate(r.date)}
                      </p>
                      <p className="muted compact">
                        Started package #{r.cycleNumber} ({r.classesInPackage}{' '}
                        classes) · previous package ended at {r.sessionsInCycle}{' '}
                        classes
                        {r.note ? ` · ${r.note}` : ''}
                      </p>
                    </div>
                    <strong>₹{r.amount.toLocaleString('en-IN')}</strong>
                  </li>
                ))}
                <li className="timeline-item">
                  <span className="timeline-dot" />
                  <div>
                    <p className="name-cell">
                      Enrolled · {formatDate(selected.paymentDate)}
                    </p>
                    <p className="muted compact">Package #1</p>
                  </div>
                  <strong>₹{selected.amountPaid.toLocaleString('en-IN')}</strong>
                </li>
              </ol>
            </div>
          </div>
        ) : (
          <div className="form-card">
            <p className="muted">Select a student to see their renewals.</p>
          </div>
        )}
      </div>
    </section>
  )
}
