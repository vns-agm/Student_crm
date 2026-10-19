import { useMemo, useState } from 'react'
import {
  cycleLimit,
  isRenewalPending,
  nextClassNumber,
  renewalCount,
} from '../hooks/useStudents'
import { BATCH_OPTIONS } from '../types'
import type { AttendanceStatus, Batch, Student } from '../types'
import { formatDate, initials, shiftDate, todayISO } from '../utils/format'
import { CycleProgress } from './CycleProgress'
import { PackageBoard } from './PackageBoard'
import { useToast } from './ToastProvider'

interface AttendanceViewProps {
  students: Student[]
  onMark: (
    studentId: string,
    date: string,
    status: AttendanceStatus | null,
  ) => Promise<Student>
  onMarkAll: (date: string, status: AttendanceStatus) => Promise<unknown>
  onGoRenewal: () => void
  onMoveAttendance: (
    studentId: string,
    recordId: string,
    cycle: number,
  ) => Promise<Student>
  onDeletePackage: (studentId: string, cycle: number) => Promise<Student>
}

const statuses: { value: AttendanceStatus; label: string }[] = [
  { value: 'present', label: 'Present' },
  { value: 'late', label: 'Late' },
  { value: 'absent', label: 'Absent' },
]

type Filter = 'all' | 'unmarked' | 'present' | 'absent' | 'due'

export function AttendanceView({
  students,
  onMark,
  onMarkAll,
  onGoRenewal,
  onMoveAttendance,
  onDeletePackage,
}: AttendanceViewProps) {
  const [date, setDate] = useState(todayISO)
  const [query, setQuery] = useState('')
  const [batch, setBatch] = useState<Batch | 'all'>('all')
  const [filter, setFilter] = useState<Filter>('all')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const { showToast } = useToast()

  function recordFor(student: Student) {
    return student.attendance.find((a) => a.date === date) ?? null
  }

  const counts = useMemo(() => {
    const result = { present: 0, late: 0, absent: 0, unmarked: 0, due: 0 }
    for (const s of students) {
      const status = s.attendance.find((a) => a.date === date)?.status
      if (status) result[status] += 1
      else result.unmarked += 1
      if (isRenewalPending(s)) result.due += 1
    }
    return result
  }, [students, date])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return students.filter((s) => {
      if (q && !s.name.toLowerCase().includes(q)) return false
      if (batch !== 'all' && s.batch !== batch) return false
      const status = s.attendance.find((a) => a.date === date)?.status
      switch (filter) {
        case 'unmarked':
          return !status
        case 'present':
          return status === 'present' || status === 'late'
        case 'absent':
          return status === 'absent'
        case 'due':
          return isRenewalPending(s)
        default:
          return true
      }
    })
  }, [students, query, batch, filter, date])

  async function mark(student: Student, status: AttendanceStatus) {
    const current = recordFor(student)?.status ?? null
    const nextStatus = current === status ? null : status
    try {
      setBusyId(student.id)
      const updated = await onMark(student.id, date, nextStatus)
      if (!nextStatus) {
        showToast(`${student.name}: attendance cleared`, 'info')
      } else if (nextStatus === 'absent') {
        showToast(`${student.name} marked absent`, 'success')
      } else {
        const saved = updated.attendance.find((a) => a.date === date)
        showToast(
          `${student.name} marked ${nextStatus} · class ${saved?.classNumber ?? '?'} of ${cycleLimit(updated)} (package #${saved?.cycle ?? updated.currentCycle})`,
          'success',
        )
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Could not update attendance.',
        'error',
      )
    } finally {
      setBusyId(null)
    }
  }

  async function markAll(status: AttendanceStatus, label: string) {
    if (
      !confirm(
        `Mark all ${students.length} students ${label.toLowerCase()} for ${formatDate(date)}?`,
      )
    ) {
      return
    }
    try {
      setBulkBusy(true)
      await onMarkAll(date, status)
      showToast(`All students marked ${label.toLowerCase()}`, 'success')
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Could not update attendance.',
        'error',
      )
    } finally {
      setBulkBusy(false)
    }
  }

  const isToday = date === todayISO()
  const filterTabs: { id: Filter; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: students.length },
    { id: 'unmarked', label: 'Not marked', count: counts.unmarked },
    { id: 'present', label: 'Present / late', count: counts.present + counts.late },
    { id: 'absent', label: 'Absent', count: counts.absent },
    { id: 'due', label: 'Renewal due', count: counts.due },
  ]

  return (
    <section className="panel">
      <header className="panel-header">
        <div>
          <h1>Attendance</h1>
          <p className="muted">
            Each present/late mark counts as the next class in the student's
            current package. The count restarts at 1 after every renewal.
          </p>
        </div>
        <div className="date-nav" role="group" aria-label="Choose date">
          <button
            type="button"
            className="btn small ghost"
            aria-label="Previous day"
            onClick={() => setDate((d) => shiftDate(d, -1))}
          >
            ‹
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            aria-label="Attendance date"
          />
          <button
            type="button"
            className="btn small ghost"
            aria-label="Next day"
            onClick={() => setDate((d) => shiftDate(d, 1))}
          >
            ›
          </button>
          <button
            type="button"
            className="btn small"
            disabled={isToday}
            onClick={() => setDate(todayISO())}
          >
            Today
          </button>
        </div>
      </header>

      <div className="att-summary">
        <div className="att-summary-item status-present">
          <span>Present</span>
          <strong>{counts.present}</strong>
        </div>
        <div className="att-summary-item status-late">
          <span>Late</span>
          <strong>{counts.late}</strong>
        </div>
        <div className="att-summary-item status-absent">
          <span>Absent</span>
          <strong>{counts.absent}</strong>
        </div>
        <div className="att-summary-item">
          <span>Not marked</span>
          <strong>{counts.unmarked}</strong>
        </div>
        <div className="att-summary-bar" aria-hidden="true">
          {(['present', 'late', 'absent'] as const).map((k) =>
            counts[k] > 0 ? (
              <span
                key={k}
                className={`seg status-${k}`}
                style={{ flexGrow: counts[k] }}
              />
            ) : null,
          )}
          {counts.unmarked > 0 ? (
            <span className="seg seg-empty" style={{ flexGrow: counts.unmarked }} />
          ) : null}
        </div>
      </div>

      <div className="att-toolbar">
        <input
          className="search"
          type="search"
          placeholder="Search student…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          value={batch}
          onChange={(e) => setBatch(e.target.value as Batch | 'all')}
          aria-label="Filter by batch"
        >
          <option value="all">All batches</option>
          {BATCH_OPTIONS.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </select>
        <div className="bulk-actions">
          <span className="muted">Mark all:</span>
          {statuses.map((s) => (
            <button
              key={s.value}
              type="button"
              className={`btn small status-${s.value}`}
              onClick={() => void markAll(s.value, s.label)}
              disabled={students.length === 0 || bulkBusy}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="chip-tabs" role="tablist">
        {filterTabs.map((t) => (
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

      <div className="attendance-list">
        {students.length === 0 ? (
          <p className="empty-cell">Add students first, then take attendance here.</p>
        ) : visible.length === 0 ? (
          <p className="empty-cell">No students match these filters.</p>
        ) : (
          visible.map((student) => {
            const record = recordFor(student)
            const current = record?.status ?? null
            const due = isRenewalPending(student)
            const expanded = expandedId === student.id
            const renewed = renewalCount(student)
            const busy = busyId === student.id

            return (
              <article
                key={student.id}
                className={`attendance-row att-card${due ? ' is-due' : ''}${busy ? ' is-busy' : ''}`}
              >
                <div className="att-main">
                  <button
                    type="button"
                    className="att-identity"
                    onClick={() => setExpandedId(expanded ? null : student.id)}
                    aria-expanded={expanded}
                    title="Show classes by package"
                  >
                    <span className="avatar" aria-hidden="true">
                      {initials(student.name)}
                    </span>
                    <span>
                      <span className="name-cell">{student.name}</span>
                      <span className="muted compact att-meta">
                        {BATCH_OPTIONS.find((b) => b.value === student.batch)?.label}
                        {' · '}Package #{student.currentCycle}
                        {' · '}Renewed {renewed}×
                      </span>
                    </span>
                  </button>

                  <div className="att-progress">
                    <CycleProgress student={student} compact />
                    {record?.classNumber ? (
                      <span className="class-badge">
                        Class {record.classNumber}
                        {record.cycle !== student.currentCycle
                          ? ` · pkg #${record.cycle}`
                          : ''}
                      </span>
                    ) : due ? (
                      <button
                        type="button"
                        className="class-badge is-due"
                        onClick={onGoRenewal}
                      >
                        Renewal due →
                      </button>
                    ) : (
                      <span className="class-badge is-next">
                        Next: class {nextClassNumber(student)}
                      </span>
                    )}
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
                        disabled={busy}
                        aria-pressed={current === s.value}
                        className={`status-btn status-${s.value}${current === s.value ? ' is-selected' : ''}`}
                        onClick={() => void mark(student, s.value)}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {expanded ? (
                  <div className="att-history">
                    <PackageBoard
                      student={student}
                      highlightDate={date}
                      onSelectDate={setDate}
                      onMove={(recordId, cycle) =>
                        onMoveAttendance(student.id, recordId, cycle)
                      }
                      onDeletePackage={(cycle) => onDeletePackage(student.id, cycle)}
                    />
                  </div>
                ) : null}
              </article>
            )
          })
        )}
      </div>
    </section>
  )
}
