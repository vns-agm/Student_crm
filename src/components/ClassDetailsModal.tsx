import { useEffect } from 'react'
import { cycleLimit, renewalCount } from '../hooks/useStudents'
import { BATCH_OPTIONS } from '../types'
import type { Student } from '../types'
import { formatDate } from '../utils/format'
import { CycleProgress } from './CycleProgress'

interface ClassDetailsModalProps {
  student: Student
  onClose: () => void
}

function statusLabel(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export function ClassDetailsModal({ student, onClose }: ClassDetailsModalProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const batchLabel =
    BATCH_OPTIONS.find((o) => o.value === student.batch)?.label ?? student.batch

  // Group records by package cycle, newest package first, classes in date order.
  const cycles = new Map<number, Student['attendance']>()
  for (const record of [...student.attendance].sort((a, b) =>
    a.date.localeCompare(b.date),
  )) {
    const list = cycles.get(record.cycle) ?? []
    list.push(record)
    cycles.set(record.cycle, list)
  }
  const cycleNumbers = Array.from(
    new Set([student.currentCycle, ...cycles.keys()]),
  ).sort((a, b) => b - a)

  function packageSize(cycle: number) {
    if (cycle === student.currentCycle) return cycleLimit(student)
    return student.renewals.find((r) => r.cycleNumber === cycle)?.classesInPackage ?? null
  }

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

        {cycleNumbers.map((cycle) => {
          const records = cycles.get(cycle) ?? []
          const size = packageSize(cycle)
          const attended = records.filter((r) => r.classNumber).length
          return (
            <section key={cycle} className="cycle-block">
              <h3 className="modal-subtitle">
                Package #{cycle}
                {cycle === student.currentCycle ? ' · current' : ''}
                <span className="muted compact">
                  {' '}
                  {attended}
                  {size ? `/${size}` : ''} classes
                </span>
              </h3>
              {records.length === 0 ? (
                <p className="muted">No classes recorded yet.</p>
              ) : (
                <ul className="class-date-list">
                  {records.map((record) => (
                    <li key={record.id}>
                      <span>
                        <span className="class-no">
                          {record.classNumber ? `Class ${record.classNumber}` : '—'}
                        </span>
                        {formatDate(record.date)}
                      </span>
                      <span className={`status-chip status-${record.status}`}>
                        {statusLabel(record.status)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )
        })}
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
