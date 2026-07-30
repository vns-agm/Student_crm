import { BATCH_OPTIONS } from '../types'
import type { Student } from '../types'

interface ClassDetailsModalProps {
  student: Student
  onClose: () => void
}

function formatDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function statusLabel(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export function ClassDetailsModal({ student, onClose }: ClassDetailsModalProps) {
  const batchLabel =
    BATCH_OPTIONS.find((o) => o.value === student.batch)?.label ?? student.batch

  const heldClasses = [...student.attendance].sort((a, b) =>
    a.date.localeCompare(b.date),
  )
  const heldCount = heldClasses.filter(
    (a) => a.status === 'present' || a.status === 'late',
  ).length

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="class-details-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <h2 id="class-details-title">{student.name}</h2>
            <p className="muted compact">
              Age {student.age} · {batchLabel}
            </p>
          </div>
          <button
            type="button"
            className="btn icon-btn"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="modal-stats">
          <div>
            <span className="muted">Number of classes</span>
            <strong>{student.numberOfClasses}</strong>
          </div>
          <div>
            <span className="muted">Classes held</span>
            <strong>{heldCount}</strong>
          </div>
          <div>
            <span className="muted">Records</span>
            <strong>{heldClasses.length}</strong>
          </div>
        </div>

        <h3 className="modal-subtitle">Class held dates</h3>
        {heldClasses.length === 0 ? (
          <p className="muted">No class dates recorded yet for this student.</p>
        ) : (
          <ul className="class-date-list">
            {heldClasses.map((record) => (
              <li key={record.id}>
                <span>{formatDate(record.date)}</span>
                <span className={`status-chip status-${record.status}`}>
                  {statusLabel(record.status)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export function EyeIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export function TrashIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  )
}
