import { useEffect } from 'react'
import { renewalCount } from '../hooks/useStudents'
import { BATCH_OPTIONS } from '../types'
import type { Student } from '../types'
import { CycleProgress } from './CycleProgress'
import { PackageBoard } from './PackageBoard'

interface ClassDetailsModalProps {
  student: Student
  onClose: () => void
  onMove?: (studentId: string, recordId: string, cycle: number) => Promise<Student>
}

export function ClassDetailsModal({
  student,
  onClose,
  onMove,
}: ClassDetailsModalProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const batchLabel =
    BATCH_OPTIONS.find((o) => o.value === student.batch)?.label ?? student.batch

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
            <span className="muted">Current package</span>
            <strong>#{student.currentCycle}</strong>
          </div>
          <div>
            <span className="muted">Times renewed</span>
            <strong>{renewalCount(student)}</strong>
          </div>
          <div>
            <span className="muted">Attended (all time)</span>
            <strong>{student.classesHeld}</strong>
          </div>
        </div>

        <CycleProgress student={student} />

        <PackageBoard
          student={student}
          onMove={onMove ? (id, cycle) => onMove(student.id, id, cycle) : undefined}
        />
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
