import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { attendanceRate, balanceDue, totalPaid } from '../hooks/useStudents'
import { BATCH_OPTIONS } from '../types'
import type { Batch, Student, StudentDetailsInput } from '../types'
import {
  ClassDetailsModal,
  EyeIcon,
  TrashIcon,
} from './ClassDetailsModal'

interface StudentsViewProps {
  students: Student[]
  onUpdate: (id: string, details: StudentDetailsInput) => Promise<unknown>
  onDelete: (id: string) => Promise<unknown>
  onGoAdd: () => void
}

const emptyForm = {
  name: '',
  age: '',
  paymentDate: '',
  numberOfClasses: '',
  feesPerClass: '',
  amountPaid: '',
  batch: '' as '' | Batch,
}

function batchLabel(batch: Batch) {
  return BATCH_OPTIONS.find((o) => o.value === batch)?.label ?? batch
}

export function StudentsView({
  students,
  onUpdate,
  onDelete,
  onGoAdd,
}: StudentsViewProps) {
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [viewing, setViewing] = useState<Student | null>(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const filtered = students.filter((s) =>
    s.name.toLowerCase().includes(query.trim().toLowerCase()),
  )

  const computedTotal = useMemo(() => {
    const classes = Number(form.numberOfClasses)
    const perClass = Number(form.feesPerClass)
    if (!Number.isFinite(classes) || !Number.isFinite(perClass)) return null
    if (classes < 1 || perClass < 0) return null
    return classes * perClass
  }, [form.numberOfClasses, form.feesPerClass])

  function startEdit(student: Student) {
    setEditingId(student.id)
    setForm({
      name: student.name,
      age: String(student.age),
      paymentDate: student.paymentDate,
      numberOfClasses: String(student.numberOfClasses),
      feesPerClass: String(student.feesPerClass),
      amountPaid: String(student.amountPaid),
      batch: student.batch,
    })
    setError('')
  }

  function resetForm() {
    setEditingId(null)
    setForm(emptyForm)
    setError('')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!editingId) return

    const name = form.name.trim()
    const age = Number(form.age)
    const numberOfClasses = Number(form.numberOfClasses)
    const feesPerClass = Number(form.feesPerClass)
    const amountPaid = Number(form.amountPaid)

    if (!name) {
      setError('Name is required.')
      return
    }
    if (!Number.isFinite(age) || age < 3 || age > 100) {
      setError('Enter a valid age (3–100).')
      return
    }
    if (!form.paymentDate) {
      setError('Payment date is required.')
      return
    }
    if (!Number.isInteger(numberOfClasses) || numberOfClasses < 1) {
      setError('Enter a valid number of classes (1 or more).')
      return
    }
    if (!Number.isFinite(feesPerClass) || feesPerClass < 0) {
      setError('Enter fees per class.')
      return
    }
    if (!Number.isFinite(amountPaid) || amountPaid < 0) {
      setError('Enter the amount paid.')
      return
    }
    if (computedTotal !== null && amountPaid > computedTotal) {
      setError('Amount paid cannot be more than total fees.')
      return
    }
    if (!form.batch) {
      setError('Select a batch.')
      return
    }

    try {
      setSaving(true)
      await onUpdate(editingId, {
        name,
        age,
        paymentDate: form.paymentDate,
        numberOfClasses,
        feesPerClass,
        amountPaid,
        batch: form.batch,
      })
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update student.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="panel">
      <header className="panel-header">
        <div>
          <h1>Students</h1>
          <p className="muted">Browse and edit students stored in the database.</p>
        </div>
        <div className="header-controls">
          <input
            className="search"
            type="search"
            placeholder="Search by name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search students"
          />
          <button type="button" className="btn primary" onClick={onGoAdd}>
            Add student details
          </button>
        </div>
      </header>

      {editingId ? (
        <form className="form-card" onSubmit={handleSubmit}>
          <h2>Edit student</h2>
          <div className="form-row two-col">
            <label>
              Name
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </label>
            <label>
              Age
              <input
                type="number"
                min={3}
                max={100}
                value={form.age}
                onChange={(e) => setForm({ ...form, age: e.target.value })}
                required
              />
            </label>
          </div>
          <div className="form-row two-col">
            <label>
              Payment date
              <input
                type="date"
                value={form.paymentDate}
                onChange={(e) =>
                  setForm({ ...form, paymentDate: e.target.value })
                }
                required
              />
            </label>
            <label>
              Batch
              <select
                value={form.batch}
                onChange={(e) =>
                  setForm({ ...form, batch: e.target.value as '' | Batch })
                }
                required
              >
                <option value="" disabled>
                  Select batch
                </option>
                {BATCH_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-row two-col">
            <label>
              Number of classes
              <input
                type="number"
                min={1}
                step={1}
                value={form.numberOfClasses}
                onChange={(e) =>
                  setForm({ ...form, numberOfClasses: e.target.value })
                }
                required
              />
            </label>
            <label>
              Fees per class (₹)
              <input
                type="number"
                min={0}
                step="any"
                value={form.feesPerClass}
                onChange={(e) =>
                  setForm({ ...form, feesPerClass: e.target.value })
                }
                required
              />
            </label>
          </div>
          <label>
            Amount paid (₹)
            <input
              type="number"
              min={0}
              step="any"
              value={form.amountPaid}
              onChange={(e) => setForm({ ...form, amountPaid: e.target.value })}
              required
            />
          </label>
          {computedTotal !== null ? (
            <p className="muted compact">
              Total fees: ₹{computedTotal.toLocaleString('en-IN')}
              {Number.isFinite(Number(form.amountPaid))
                ? ` · Balance: ₹${Math.max(0, computedTotal - Number(form.amountPaid)).toLocaleString('en-IN')}`
                : ''}
            </p>
          ) : null}
          {error ? <p className="form-error">{error}</p> : null}
          <div className="form-actions">
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button type="button" className="btn ghost" onClick={resetForm}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Age</th>
              <th>Batch</th>
              <th>Payment date</th>
              <th>Classes</th>
              <th>Fees / class</th>
              <th>Total fees</th>
              <th>Paid</th>
              <th>Balance</th>
              <th>Attendance</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={11} className="empty-cell">
                  {students.length === 0
                    ? 'No students in the database yet. Use Add student details.'
                    : 'No students match your search.'}
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr key={s.id}>
                  <td className="name-cell">{s.name}</td>
                  <td>{s.age}</td>
                  <td>
                    <span className="pill">{batchLabel(s.batch)}</span>
                  </td>
                  <td>{s.paymentDate || '—'}</td>
                  <td>{s.numberOfClasses}</td>
                  <td>₹{s.feesPerClass.toLocaleString('en-IN')}</td>
                  <td>₹{s.totalFees.toLocaleString('en-IN')}</td>
                  <td>₹{totalPaid(s).toLocaleString('en-IN')}</td>
                  <td>
                    <span className={balanceDue(s) > 0 ? 'text-warn' : 'text-ok'}>
                      ₹{balanceDue(s).toLocaleString('en-IN')}
                    </span>
                  </td>
                  <td>
                    <span className="pill">{attendanceRate(s)}%</span>
                  </td>
                  <td className="row-actions">
                    <button
                      type="button"
                      className="btn small icon-btn"
                      aria-label={`View class details for ${s.name}`}
                      title="View class details"
                      onClick={() => setViewing(s)}
                    >
                      <EyeIcon />
                    </button>
                    <button
                      type="button"
                      className="btn small"
                      onClick={() => startEdit(s)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn small icon-btn danger"
                      aria-label={`Delete ${s.name}`}
                      title="Delete student"
                      onClick={async () => {
                        if (!confirm(`Remove ${s.name}?`)) return
                        try {
                          await onDelete(s.id)
                          if (viewing?.id === s.id) setViewing(null)
                          if (editingId === s.id) resetForm()
                        } catch (err) {
                          alert(
                            err instanceof Error
                              ? err.message
                              : 'Could not delete student.',
                          )
                        }
                      }}
                    >
                      <TrashIcon />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {viewing ? (
        <ClassDetailsModal student={viewing} onClose={() => setViewing(null)} />
      ) : null}
    </section>
  )
}
