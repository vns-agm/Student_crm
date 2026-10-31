import type { AuthUser, TenantBranding, UserRole, View } from '../types'

// Lucide-style outline icons, one per section.
const NAV_ICONS: Record<View, string> = {
  overview: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
  'add-student': 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M19 8v6M22 11h-6',
  students: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  attendance: 'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM16 2v4M8 2v4M3 10h18M9 16l2 2 4-4',
  fees: 'M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zM2 10h20M6 15h4',
  renewal: 'M3 12a9 9 0 0 1 15.5-6.3L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.3L3 16M3 21v-5h5',
  tournament: 'M6 9H4a2 2 0 0 1-2-2V5h4M18 9h2a2 2 0 0 0 2-2V5h-4M6 3h12v6a6 6 0 0 1-12 0zM12 15v4M8 21h8',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4',
}

function NavIcon({ view }: { view: View }) {
  return (
    <svg
      className="nav-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={NAV_ICONS[view]} />
    </svg>
  )
}

interface SidebarProps {
  current: View
  onChange: (view: View) => void
  studentCount: number
  user: AuthUser
  branding?: TenantBranding | null
}

const allLinks: {
  id: View
  label: string
  hint: string
  roles: UserRole[]
  ownerOnly?: boolean
}[] = [
  { id: 'overview', label: 'Overview', hint: 'Snapshot', roles: ['admin', 'parent'] },
  { id: 'add-student', label: 'Add student', hint: 'New details', roles: ['admin'] },
  { id: 'students', label: 'Students', hint: 'All records', roles: ['admin'] },
  { id: 'attendance', label: 'Attendance', hint: 'Daily roll', roles: ['admin'] },
  { id: 'fees', label: 'Fees', hint: 'Payments', roles: ['admin'] },
  { id: 'renewal', label: 'Renewal', hint: 'Packages & history', roles: ['admin'] },
  { id: 'tournament', label: 'Tournament', hint: 'Swiss pairing', roles: ['admin', 'parent'] },
  {
    id: 'settings',
    label: 'White-label',
    hint: 'Brand & coaches',
    roles: ['admin'],
    ownerOnly: true,
  },
]

export function Sidebar({
  current,
  onChange,
  studentCount,
  user,
  branding,
}: SidebarProps) {
  const links = allLinks.filter((link) => {
    if (!link.roles.includes(user.role)) return false
    if (link.ownerOnly && !user.isOwner) return false
    return true
  })
  const displayName = branding?.displayName || 'Agam Chess Classes'
  const logoUrl = branding?.logoUrl || ''

  return (
    <aside className="sidebar">
      <div className="brand">
        {logoUrl ? (
          <img className="brand-logo" src={logoUrl} alt="" />
        ) : (
          <span className="brand-mark" aria-hidden="true" />
        )}
        <div className="brand-text">
          <p className="brand-name">{displayName}</p>
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
            title={link.label}
            aria-label={link.label}
            aria-current={current === link.id ? 'page' : undefined}
          >
            <NavIcon view={link.id} />
            <span className="nav-text">
              <span className="nav-label">{link.label}</span>
              <span className="nav-hint">{link.hint}</span>
            </span>
          </button>
        ))}
      </nav>

      <div className="sidebar-foot">
        <p className="sidebar-stat">{studentCount} students</p>
        <p className="sidebar-note">
          Signed in as {user.username} ({user.role})
        </p>
      </div>
    </aside>
  )
}
