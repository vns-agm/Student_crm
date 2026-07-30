import type { View } from '../types'

interface SidebarProps {
  current: View
  onChange: (view: View) => void
  studentCount: number
}

const links: { id: View; label: string; hint: string }[] = [
  { id: 'overview', label: 'Overview', hint: 'Snapshot' },
  { id: 'add-student', label: 'Add student', hint: 'New details' },
  { id: 'students', label: 'Students', hint: 'All records' },
  { id: 'attendance', label: 'Attendance', hint: 'Daily roll' },
  { id: 'fees', label: 'Fees', hint: 'Payments' },
]

export function Sidebar({ current, onChange, studentCount }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true" />
        <div>
          <p className="brand-name">ClassLedger</p>
          <p className="brand-tag">Student CRM</p>
        </div>
      </div>

      <nav className="nav" aria-label="Main">
        {links.map((link) => (
          <button
            key={link.id}
            type="button"
            className={`nav-item${current === link.id ? ' is-active' : ''}`}
            onClick={() => onChange(link.id)}
          >
            <span className="nav-label">{link.label}</span>
            <span className="nav-hint">{link.hint}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-foot">
        <p className="sidebar-stat">{studentCount} students</p>
        <p className="sidebar-note">Stored in SQLite database</p>
      </div>
    </aside>
  )
}
