import { cycleLimit, sessionsInCycle } from '../hooks/useStudents'
import type { Student } from '../types'

interface CycleProgressProps {
  student: Student
  compact?: boolean
}

/** Progress through the current package: "Class 3 of 8", restarting at 1 after each renewal. */
export function CycleProgress({ student, compact = false }: CycleProgressProps) {
  const done = sessionsInCycle(student)
  const limit = cycleLimit(student)
  const pct = Math.min(100, Math.round((done / limit) * 100))
  const tone = done >= limit ? 'is-complete' : done >= limit - 1 ? 'is-near' : ''

  return (
    <div className={`cycle-progress ${tone}${compact ? ' is-compact' : ''}`}>
      <div className="cycle-progress-label">
        <span>
          <strong>{done}</strong>/{limit} classes
        </span>
        {!compact ? (
          <span className="muted">Package #{student.currentCycle ?? 1}</span>
        ) : null}
      </div>
      <div
        className="cycle-progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={done}
        aria-label={`${done} of ${limit} classes in current package`}
      >
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
