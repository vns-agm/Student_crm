import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { BATCH_OPTIONS, CATEGORY_OPTIONS } from '../types'
import type { Batch, Category, StudentDetailsInput } from '../types'

interface AddStudentViewProps {
  onAdd: (details: StudentDetailsInput) => Promise<unknown>
  onGoStudents: () => void
}

const emptyForm = {
  name: '',
  age: '',
  paymentDate: '',
  numberOfClasses: '',
  feesPerClass: '',
  amountPaid: '',
  batch: '' as '' | Batch,
  category: '' as '' | Category,
}

export function AddStudentView({ onAdd, onGoStudents }: AddStudentViewProps) {
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)

  const computedTotal = useMemo(() => {
    const classes = Number(form.numberOfClasses)
    const perClass = Number(form.feesPerClass)
    if (!Number.isFinite(classes) || !Number.isFinite(perClass)) return null
    if (classes < 1 || perClass < 0) return null
    return classes * perClass
  }, [form.numberOfClasses, form.feesPerClass])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

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
    if (!form.category) {
      setError('Select a category.')
      return
    }

    try {
      setSaving(true)
      await onAdd({
        name,
        age,
        paymentDate: form.paymentDate,
        numberOfClasses,
        feesPerClass,
        amountPaid,
        batch: form.batch,
        category: form.category,
      })
      setForm(emptyForm)
      setSuccess(`${name} was saved to the database.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save student.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="panel">
      <header className="panel-header">
        <div>
          <h1>Add student details</h1>
          <p className="muted">
            Enter name, age, category, payment date, classes, fees, amount paid, and batch.
          </p>
        </div>
        <button type="button" className="btn ghost" onClick={onGoStudents}>
          View all students
        </button>
      </header>

      <form className="form-card add-student-form" onSubmit={handleSubmit}>
        <h2>Student details</h2>
        <label>
          Full name
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Enter student name"
            autoComplete="name"
            required
          />
        </label>
        <div className="form-row two-col">
          <label>
            Age
            <input
              type="number"
              min={3}
              max={100}
              value={form.age}
              onChange={(e) => setForm({ ...form, age: e.target.value })}
              placeholder="Enter age"
              required
            />
          </label>
          <label>
            Payment date
            <input
              type="date"
              value={form.paymentDate}
              onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
              required
            />
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
              placeholder="Enter number of classes"
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
              onChange={(e) => setForm({ ...form, feesPerClass: e.target.value })}
              placeholder="Enter fees per class"
              required
            />
          </label>
        </div>
        <div className="form-row two-col">
          <label>
            Amount paid (₹)
            <input
              type="number"
              min={0}
              step="any"
              value={form.amountPaid}
              onChange={(e) => setForm({ ...form, amountPaid: e.target.value })}
              placeholder="Enter amount paid"
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
        <label>
          Category
          <select
            value={form.category}
            onChange={(e) =>
              setForm({ ...form, category: e.target.value as '' | Category })
            }
            required
          >
            <option value="" disabled>
              Select category
            </option>
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
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
        {success ? <p className="form-success">{success}</p> : null}
        <div className="form-actions">
          <button type="submit" className="btn primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save to database'}
          </button>
        </div>
      </form>
    </section>
  )
}
