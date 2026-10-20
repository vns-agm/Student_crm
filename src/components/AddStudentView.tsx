import { useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { BATCH_OPTIONS, CATEGORY_OPTIONS } from '../types'
import type { Batch, Category, StudentDetailsInput } from '../types'
import { initials, todayISO } from '../utils/format'

interface AddStudentViewProps {
  onAdd: (details: StudentDetailsInput) => Promise<unknown>
  onGoStudents: () => void
}

const emptyForm = () => ({
  name: '',
  age: '',
  paymentDate: todayISO(),
  numberOfClasses: '8',
  feesPerClass: '',
  amountPaid: '',
  batch: 'beginner' as Batch,
  category: '' as '' | Category,
})

const CLASS_PRESETS = [4, 8, 12, 16]

function suggestedCategory(age: number): Category | '' {
  if (!Number.isFinite(age) || age < 3) return ''
  if (age < 10) return 'u10'
  if (age < 15) return 'u15'
  return 'open'
}

function rupees(value: number) {
  return `₹${value.toLocaleString('en-IN')}`
}

export function AddStudentView({ onAdd, onGoStudents }: AddStudentViewProps) {
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [lastSaved, setLastSaved] = useState('')
  const [saving, setSaving] = useState(false)
  const [categoryTouched, setCategoryTouched] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  const classes = Number(form.numberOfClasses)
  const perClass = Number(form.feesPerClass)
  const paid = Number(form.amountPaid) || 0

  const total = useMemo(() => {
    if (!Number.isInteger(classes) || classes < 1) return null
    if (form.feesPerClass === '' || !Number.isFinite(perClass) || perClass < 0) {
      return null
    }
    return classes * perClass
  }, [classes, perClass, form.feesPerClass])

  const balance = total === null ? null : Math.max(0, total - paid)
  const paidPct = total ? Math.min(100, Math.round((paid / total) * 100)) : 0
  const overpaid = total !== null && paid > total

  function update<K extends keyof ReturnType<typeof emptyForm>>(
    key: K,
    value: ReturnType<typeof emptyForm>[K],
  ) {
    setError('')
    setForm((prev) => {
      const next = { ...prev, [key]: value }
      // Auto-pick the age category until the user chooses one themselves.
      if (key === 'age' && !categoryTouched) {
        next.category = suggestedCategory(Number(value))
      }
      return next
    })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    const name = form.name.trim()
    const age = Number(form.age)

    if (!name) return setError('Name is required.')
    if (!Number.isFinite(age) || age < 3 || age > 100) {
      return setError('Enter a valid age (3–100).')
    }
    if (!form.paymentDate) return setError('Payment date is required.')
    if (!Number.isInteger(classes) || classes < 1) {
      return setError('Enter a valid number of classes (1 or more).')
    }
    if (total === null) return setError('Enter fees per class.')
    if (!Number.isFinite(Number(form.amountPaid)) || paid < 0) {
      return setError('Enter the amount paid.')
    }
    if (overpaid) return setError('Amount paid cannot be more than total fees.')
    if (!form.category) return setError('Select a category.')

    try {
      setSaving(true)
      await onAdd({
        name,
        age,
        paymentDate: form.paymentDate,
        numberOfClasses: classes,
        feesPerClass: perClass,
        amountPaid: paid,
        batch: form.batch,
        category: form.category,
      })
      setLastSaved(name)
      // Keep the package and fee settings for quickly adding siblings/batches.
      setForm((prev) => ({
        ...emptyForm(),
        numberOfClasses: prev.numberOfClasses,
        feesPerClass: prev.feesPerClass,
        batch: prev.batch,
      }))
      setCategoryTouched(false)
      nameRef.current?.focus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save student.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="panel add-student-panel">
      <header className="panel-header">
        <div>
          <h1>Add student</h1>
          <p className="muted">New enrolment starts at package #1, class 1.</p>
        </div>
        <button type="button" className="btn ghost" onClick={onGoStudents}>
          View all students
        </button>
      </header>

      {lastSaved ? (
        <div className="save-banner" role="status">
          <span>
            <strong>{lastSaved}</strong> was added. Ready for the next student.
          </span>
          <span className="save-banner-actions">
            <button type="button" className="link-btn" onClick={onGoStudents}>
              View students →
            </button>
            <button
              type="button"
              className="btn icon-btn small ghost"
              aria-label="Dismiss"
              onClick={() => setLastSaved('')}
            >
              ×
            </button>
          </span>
        </div>
      ) : null}

      <form className="add-student-grid" onSubmit={handleSubmit} noValidate>
        <div className="form-card add-student-form">
          <fieldset className="form-section">
            <legend>
              <span className="step-dot">1</span> Student
            </legend>
            <div className="form-row add-row-name">
              <label>
                Full name
                <input
                  ref={nameRef}
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                  placeholder="e.g. Aarav Sharma"
                  autoComplete="off"
                  autoFocus
                />
              </label>
              <label>
                Age
                <input
                  type="number"
                  min={3}
                  max={100}
                  inputMode="numeric"
                  value={form.age}
                  onChange={(e) => update('age', e.target.value)}
                  placeholder="Age"
                />
              </label>
            </div>
            <div className="form-row two-col">
              <div className="field">
                <span className="field-label">Batch</span>
                <div className="segmented" role="radiogroup" aria-label="Batch">
                  {BATCH_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      role="radio"
                      aria-checked={form.batch === o.value}
                      className={form.batch === o.value ? 'is-active' : ''}
                      onClick={() => update('batch', o.value)}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field">
                <span className="field-label">
                  Category
                  {!categoryTouched && form.category ? (
                    <span className="field-hint">auto from age</span>
                  ) : null}
                </span>
                <div className="segmented" role="radiogroup" aria-label="Category">
                  {CATEGORY_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      role="radio"
                      aria-checked={form.category === o.value}
                      className={form.category === o.value ? 'is-active' : ''}
                      onClick={() => {
                        setCategoryTouched(true)
                        update('category', o.value)
                      }}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </fieldset>

          <fieldset className="form-section">
            <legend>
              <span className="step-dot">2</span> Package &amp; fees
            </legend>
            <div className="form-row add-row-package">
              <label>
                Classes in package
                <input
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={form.numberOfClasses}
                  onChange={(e) => update('numberOfClasses', e.target.value)}
                />
                <span className="preset-chips">
                  {CLASS_PRESETS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={classes === n ? 'is-active' : ''}
                      onClick={() => update('numberOfClasses', String(n))}
                    >
                      {n}
                    </button>
                  ))}
                </span>
              </label>
              <label>
                Fees per class (₹)
                <input
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  value={form.feesPerClass}
                  onChange={(e) => update('feesPerClass', e.target.value)}
                  placeholder="e.g. 500"
                />
              </label>
              <label>
                Payment date
                <input
                  type="date"
                  value={form.paymentDate}
                  onChange={(e) => update('paymentDate', e.target.value)}
                />
              </label>
            </div>
            <label className="paid-field">
              Amount paid (₹)
              <span className="input-with-action">
                <input
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  value={form.amountPaid}
                  onChange={(e) => update('amountPaid', e.target.value)}
                  placeholder="0"
                  aria-invalid={overpaid}
                />
                <button
                  type="button"
                  className="btn small"
                  disabled={total === null}
                  onClick={() => update('amountPaid', String(total ?? ''))}
                >
                  Paid in full
                </button>
              </span>
            </label>
          </fieldset>

          {error ? <p className="form-error">{error}</p> : null}
        </div>

        <aside className="form-card add-summary">
          <div className="add-summary-head">
            <span className="avatar avatar-lg" aria-hidden="true">
              {initials(form.name) || '?'}
            </span>
            <div>
              <p className="name-cell">{form.name.trim() || 'New student'}</p>
              <p className="muted compact">
                {form.age ? `Age ${form.age} · ` : ''}
                {BATCH_OPTIONS.find((b) => b.value === form.batch)?.label}
                {form.category
                  ? ` · ${CATEGORY_OPTIONS.find((c) => c.value === form.category)?.label}`
                  : ''}
              </p>
            </div>
          </div>

          <dl className="add-summary-rows">
            <div>
              <dt>Package</dt>
              <dd>
                {Number.isInteger(classes) && classes > 0 ? `${classes} classes` : '—'}
              </dd>
            </div>
            <div>
              <dt>Total fees</dt>
              <dd>{total === null ? '—' : rupees(total)}</dd>
            </div>
            <div>
              <dt>Paid</dt>
              <dd>{rupees(paid)}</dd>
            </div>
            <div className="is-balance">
              <dt>Balance</dt>
              <dd className={overpaid ? 'text-danger' : balance ? 'text-warn' : 'text-ok'}>
                {overpaid ? 'Over total' : balance === null ? '—' : rupees(balance)}
              </dd>
            </div>
          </dl>

          <div
            className="cycle-progress-track paid-track"
            role="progressbar"
            aria-label="Paid so far"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={paidPct}
          >
            <span style={{ width: `${paidPct}%` }} />
          </div>
          <p className="muted compact">{paidPct}% paid</p>

          <button type="submit" className="btn primary add-submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save student'}
          </button>
          <button
            type="button"
            className="btn ghost add-submit"
            onClick={() => {
              setForm(emptyForm())
              setCategoryTouched(false)
              setError('')
              nameRef.current?.focus()
            }}
          >
            Clear form
          </button>
        </aside>
      </form>
    </section>
  )
}
