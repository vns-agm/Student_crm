import { useState } from 'react'
import type { AttendanceStatus, Student } from '../types'
import { useToast } from './ToastProvider'

interface AttendanceViewProps {
  students: Student[]
  onMark: (
    studentId: string,
    date: string,
    status: AttendanceStatus,
  ) => Promise<unknown>
  onMarkAll: (date: string, status: AttendanceStatus) => Promise<unknown>
}

const statuses: { value: AttendanceStatus; label: string }[] = [
  { value: 'present', label: 'Present' },
  { value: 'late', label: 'Late' },
  { value: 'absent', label: 'Absent' },
]

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export function AttendanceView({
  students,
  onMark,
  onMarkAll,
}: AttendanceViewProps) {
  const [date, setDate] = useState(todayISO)
  const { showToast } = useToast()

  function statusFor(student: Student): AttendanceStatus | null {
    return student.attendance.find((a) => a.date === date)?.status ?? null
  }

  const presentCount = students.filter((s) => {
    const st = statusFor(s)
    return st === 'present' || st === 'late'
  }).length

  return (
    <section className="panel">
      <header className="panel-header">
        <div>
          <h1>Attendance</h1>
          <p className="muted">Mark who showed up for a selected date.</p>
        </div>
        <div className="header-controls">
          <label className="date-label">
            Date
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <p className="muted compact">
            {presentCount}/{students.length} present or late
          </p>
        </div>
      </header>

      <div className="bulk-actions">
        <span className="muted">Mark all:</span>
        {statuses.map((s) => (
          <button
            key={s.value}
            type="button"
            className={`btn small status-${s.value}`}
            onClick={async () => {
              try {
                await onMarkAll(date, s.value)
                showToast(`All students marked ${s.label.toLowerCase()}`, 'success')
              } catch (err) {
                showToast(
                  err instanceof Error
                    ? err.message
                    : 'Could not update attendance.',
                  'error',
                )
              }
            }}
            disabled={students.length === 0}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="attendance-list">
        {students.length === 0 ? (
          <p className="empty-cell">Add students first, then take attendance here.</p>
        ) : (
          students.map((student) => {
            const current = statusFor(student)
            return (
              <article key={student.id} className="attendance-row">
                <div>
                  <p className="name-cell">{student.name}</p>
                  <p className="muted compact">Age {student.age}</p>
                </div>
                <div
                  className="status-group"
                  role="group"
                  aria-label={`Attendance for ${student.name}`}
                >
                  {statuses.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      className={`status-btn status-${s.value}${current === s.value ? ' is-selected' : ''}`}
                      onClick={async () => {
                        try {
                          await onMark(student.id, date, s.value)
                          showToast(
                            `${student.name} marked ${s.label.toLowerCase()}`,
                            'success',
                          )
                        } catch (err) {
                          showToast(
                            err instanceof Error
                              ? err.message
                              : 'Could not update attendance.',
                            'error',
                          )
                        }
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </article>
            )
          })
        )}
      </div>
    </section>
  )
}
