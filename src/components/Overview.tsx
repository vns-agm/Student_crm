import { useState } from 'react'
import {
  attendanceRate,
  balanceDue,
  classesHeld,
  isRenewalPending,
  totalPaid,
} from '../hooks/useStudents'
import { BATCH_OPTIONS } from '../types'
import type { Batch, Student } from '../types'
import { exportStudentsToCsv } from '../utils/exportCsv'
import {
  ClassDetailsModal,
  EyeIcon,
  TrashIcon,
} from './ClassDetailsModal'

interface OverviewProps {
  students: Student[]
  readOnly?: boolean
  onGoAdd: () => void
  onGoStudents: () => void
  onGoAttendance: () => void
  onGoFees: () => void
  onGoRenewal: () => void
  onDelete: (id: string) => Promise<unknown>
}

function batchLabel(batch: Batch) {
  return BATCH_OPTIONS.find((o) => o.value === batch)?.label ?? batch
}

export function Overview({
  students,
  readOnly = false,
  onGoAdd,
  onGoStudents,
  onGoAttendance,
  onGoFees,
  onGoRenewal,
  onDelete,
}: OverviewProps) {
  const [viewing, setViewing] = useState<Student | null>(null)
  const renewalPendingCount = students.filter((s) => isRenewalPending(s)).length
  const totalFeesCollected = students.reduce((sum, s) => sum + totalPaid(s), 0)
  const totalOutstanding = students.reduce((sum, s) => sum + balanceDue(s), 0)
  const avgAttendance =
    students.length === 0
      ? 0
      : Math.round(
          students.reduce((sum, s) => sum + attendanceRate(s), 0) /
            students.length,
        )

  const today = new Date().toISOString().slice(0, 10)
  const markedToday = students.filter((s) =>
    s.attendance.some((a) => a.date === today),
  ).length

  return (
    <section className="panel">
      <header className="panel-header">
        <div>
          <h1>Overview</h1>
        </div>
        {!readOnly ? (
          <div className="header-controls">
            <button
              type="button"
              className="btn ghost"
              onClick={() => exportStudentsToCsv(students)}
              disabled={students.length === 0}
            >
              Export CSV
            </button>
            <button type="button" className="btn primary" onClick={onGoAdd}>
              Add student details
            </button>
          </div>
        ) : null}
      </header>

      <div className={`stat-grid${readOnly ? ' parent-stats' : ''}`}>
        <article className="stat-card">
          <p className="stat-label">Students</p>
          <p className="stat-value">{students.length}</p>
          {!readOnly ? (
            <button type="button" className="link-btn" onClick={onGoStudents}>
              Manage students
            </button>
          ) : (
            <p className="stat-sub muted">Parent view</p>
          )}
        </article>
        <article className="stat-card">
          <p className="stat-label">Avg attendance</p>
          <p className="stat-value">{avgAttendance}%</p>
          {!readOnly ? (
            <button type="button" className="link-btn" onClick={onGoAttendance}>
              Take roll call
            </button>
          ) : null}
        </article>
        {!readOnly ? (
          <>
            <article className="stat-card">
              <p className="stat-label">Fees collected</p>
              <p className="stat-value">
                ₹{totalFeesCollected.toLocaleString('en-IN')}
              </p>
              <button type="button" className="link-btn" onClick={onGoFees}>
                Record payment
              </button>
            </article>
            <article className="stat-card">
              <p className="stat-label">Renewal pending</p>
              <p className="stat-value accent">{renewalPendingCount}</p>
              {!readOnly ? (
                <button type="button" className="link-btn" onClick={onGoRenewal}>
                  Manage renewals
                </button>
              ) : null}
            </article>
            <article className="stat-card">
              <p className="stat-label">Outstanding</p>
              <p className="stat-value accent">
                ₹{totalOutstanding.toLocaleString('en-IN')}
              </p>
              <p className="stat-sub muted">
                {markedToday}/{students.length} marked today
              </p>
            </article>
          </>
        ) : null}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Age</th>
              <th>Batch</th>
              <th>Classes held</th>
              <th>Renewal</th>
              <th>Attendance</th>
              <th>Paid</th>
              <th>Balance</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.length === 0 ? (
              <tr>
                <td colSpan={9} className="empty-cell">
                  No student records to show yet.
                </td>
              </tr>
            ) : (
              students.map((s) => (
                <tr key={s.id}>
                  <td className="name-cell">{s.name}</td>
                  <td>{s.age}</td>
                  <td>
                    <span className="pill">{batchLabel(s.batch)}</span>
                  </td>
                  <td>{classesHeld(s)}</td>
                  <td>
                    {isRenewalPending(s) ? (
                      <span className="pill renewal-pending">Pending</span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    <span className="pill">{attendanceRate(s)}%</span>
                  </td>
                  <td>₹{totalPaid(s).toLocaleString('en-IN')}</td>
                  <td>
                    <span className={balanceDue(s) > 0 ? 'text-warn' : 'text-ok'}>
                      ₹{balanceDue(s).toLocaleString('en-IN')}
                    </span>
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
                    {!readOnly ? (
                      <button
                        type="button"
                        className="btn small icon-btn danger"
                        aria-label={`Delete ${s.name}`}
                        title="Delete student"
                        onClick={async () => {
                          if (!confirm(`Remove ${s.name}?`)) return
                          try {
                            await onDelete(s.id)
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
                    ) : null}
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
