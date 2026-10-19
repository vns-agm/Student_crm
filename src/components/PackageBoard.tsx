import { useState } from 'react'
import type { DragEvent } from 'react'
import { cycleLimit } from '../hooks/useStudents'
import type { AttendanceRecord, Student } from '../types'
import { formatDate } from '../utils/format'
import { TrashIcon } from './ClassDetailsModal'
import { useToast } from './ToastProvider'

interface PackageBoardProps {
  student: Student
  /** When provided, classes can be dragged (or nudged with arrows) between packages. */
  onMove?: (recordId: string, cycle: number) => Promise<Student>
  /** When provided, packages after #1 get a delete button. */
  onDeletePackage?: (cycle: number) => Promise<Student>
  highlightDate?: string
  onSelectDate?: (date: string) => void
}

const DRAG_TYPE = 'application/x-attendance-id'

function statusLabel(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

/** All of a student's classes laid out per package, oldest package first. */
export function PackageBoard({
  student,
  onMove,
  onDeletePackage,
  highlightDate,
  onSelectDate,
}: PackageBoardProps) {
  const { showToast } = useToast()
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCycle, setOverCycle] = useState<number | null>(null)
  const [movingId, setMovingId] = useState<string | null>(null)
  const [deletingCycle, setDeletingCycle] = useState<number | null>(null)

  const byCycle = new Map<number, AttendanceRecord[]>()
  for (let c = 1; c <= student.currentCycle; c += 1) byCycle.set(c, [])
  for (const record of [...student.attendance].sort((a, b) =>
    a.date.localeCompare(b.date),
  )) {
    byCycle.get(record.cycle)?.push(record)
  }

  function packageSize(cycle: number) {
    if (cycle === student.currentCycle) return cycleLimit(student)
    return student.renewals.find((r) => r.cycleNumber === cycle)?.classesInPackage ?? null
  }

  async function move(record: AttendanceRecord, cycle: number) {
    if (!onMove || record.cycle === cycle) return
    try {
      setMovingId(record.id)
      const updated = await onMove(record.id, cycle)
      const moved = updated.attendance.find((a) => a.id === record.id)
      showToast(
        moved?.classNumber
          ? `${formatDate(record.date)} moved to package #${cycle} as class ${moved.classNumber}`
          : `${formatDate(record.date)} moved to package #${cycle}`,
        'success',
      )
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not move class.', 'error')
    } finally {
      setMovingId(null)
    }
  }

  async function deletePackage(cycle: number) {
    if (!onDeletePackage) return
    const renewal = student.renewals.find((r) => r.cycleNumber === cycle)
    const count = byCycle.get(cycle)?.length ?? 0
    const lines = [
      `Delete package #${cycle} for ${student.name}?`,
      '',
      count > 0
        ? `• Its ${count} attendance record${count === 1 ? '' : 's'} will move into package #${cycle - 1}.`
        : '• It has no attendance records.',
      renewal
        ? `• The renewal payment of ₹${renewal.amount.toLocaleString('en-IN')} (${formatDate(renewal.date)}) will be deleted.`
        : '',
      cycle < student.currentCycle ? '• Later packages will be renumbered.' : '',
    ].filter(Boolean)
    if (!confirm(lines.join('\n'))) return
    try {
      setDeletingCycle(cycle)
      const updated = await onDeletePackage(cycle)
      showToast(
        `Package #${cycle} deleted · ${student.name} renewed ${updated.renewalCount}×`,
        'success',
      )
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not delete package.', 'error')
    } finally {
      setDeletingCycle(null)
    }
  }

  function handleDrop(e: DragEvent, cycle: number) {
    e.preventDefault()
    const id = e.dataTransfer.getData(DRAG_TYPE) || dragId
    setOverCycle(null)
    setDragId(null)
    const record = student.attendance.find((a) => a.id === id)
    if (record) void move(record, cycle)
  }

  const cycles = Array.from(byCycle.keys())

  return (
    <div className="package-board">
      {onMove && student.currentCycle > 1 ? (
        <p className="muted compact package-board-hint">
          Drag a class onto another package (or use the arrows) to move it.
          Classes are numbered by date inside each package.
        </p>
      ) : null}
      <div className="package-columns">
        {cycles.map((cycle) => {
          const records = byCycle.get(cycle) ?? []
          const size = packageSize(cycle)
          const attended = records.filter((r) => r.classNumber).length
          const isTarget = overCycle === cycle && dragId !== null
          const source = student.attendance.find((a) => a.id === dragId)
          const canDrop = isTarget && source?.cycle !== cycle

          return (
            <section
              key={cycle}
              className={`package-column${cycle === student.currentCycle ? ' is-current' : ''}${canDrop ? ' is-drop-target' : ''}${deletingCycle === cycle ? ' is-deleting' : ''}`}
              onDragOver={
                onMove
                  ? (e) => {
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'move'
                      if (overCycle !== cycle) setOverCycle(cycle)
                    }
                  : undefined
              }
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                  setOverCycle((c) => (c === cycle ? null : c))
                }
              }}
              onDrop={onMove ? (e) => handleDrop(e, cycle) : undefined}
            >
              <header className="package-column-head">
                <strong>Package #{cycle}</strong>
                <span className="muted compact">
                  {attended}
                  {size ? `/${size}` : ''} classes
                  {cycle === student.currentCycle ? ' · current' : ''}
                </span>
                {onDeletePackage && cycle > 1 ? (
                  <button
                    type="button"
                    className="package-delete"
                    disabled={deletingCycle !== null}
                    aria-label={`Delete package ${cycle}`}
                    title={`Delete package #${cycle}`}
                    onClick={() => void deletePackage(cycle)}
                  >
                    <TrashIcon />
                  </button>
                ) : null}
              </header>

              {records.length === 0 ? (
                <p className="package-empty muted compact">
                  {onMove ? 'Drop a class here' : 'No classes yet'}
                </p>
              ) : (
                <ul className="package-list">
                  {records.map((record) => (
                    <li
                      key={record.id}
                      className={`package-item status-${record.status}${record.date === highlightDate ? ' is-current' : ''}${dragId === record.id ? ' is-dragging' : ''}${movingId === record.id ? ' is-moving' : ''}`}
                      draggable={Boolean(onMove)}
                      onDragStart={(e) => {
                        e.dataTransfer.setData(DRAG_TYPE, record.id)
                        e.dataTransfer.effectAllowed = 'move'
                        setDragId(record.id)
                      }}
                      onDragEnd={() => {
                        setDragId(null)
                        setOverCycle(null)
                      }}
                    >
                      {onMove ? (
                        <span className="drag-handle" aria-hidden="true">
                          ⋮⋮
                        </span>
                      ) : null}
                      <button
                        type="button"
                        className="package-item-body"
                        onClick={() => onSelectDate?.(record.date)}
                        disabled={!onSelectDate}
                      >
                        <span className="class-no">
                          {record.classNumber ? `Class ${record.classNumber}` : 'Absent'}
                        </span>
                        <span className="muted compact">{formatDate(record.date)}</span>
                      </button>
                      <span className={`status-chip status-${record.status}`}>
                        {statusLabel(record.status)[0]}
                      </span>
                      {onMove ? (
                        <span className="move-arrows">
                          <button
                            type="button"
                            disabled={cycle === 1 || movingId !== null}
                            aria-label={`Move ${formatDate(record.date)} to package ${cycle - 1}`}
                            title={`Move to package #${cycle - 1}`}
                            onClick={() => void move(record, cycle - 1)}
                          >
                            ‹
                          </button>
                          <button
                            type="button"
                            disabled={cycle === student.currentCycle || movingId !== null}
                            aria-label={`Move ${formatDate(record.date)} to package ${cycle + 1}`}
                            title={`Move to package #${cycle + 1}`}
                            onClick={() => void move(record, cycle + 1)}
                          >
                            ›
                          </button>
                        </span>
                      ) : null}
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
