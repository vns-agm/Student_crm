import type { AuthUser, TenantBranding, UserRole, View } from '../types'

interface SidebarProps {
  current: View
  onChange: (view: View) => void
  studentCount: number
  user: AuthUser
  branding?: TenantBranding | null
  onLogout: () => void
}

const allLinks: { id: View; label: string; hint: string; roles: UserRole[] }[] = [
  { id: 'overview', label: 'Overview', hint: 'Snapshot', roles: ['admin', 'parent'] },
  { id: 'add-student', label: 'Add student', hint: 'New details', roles: ['admin'] },
  { id: 'students', label: 'Students', hint: 'All records', roles: ['admin'] },
  { id: 'attendance', label: 'Attendance', hint: 'Daily roll', roles: ['admin'] },
  { id: 'fees', label: 'Fees', hint: 'Payments', roles: ['admin'] },
  { id: 'tournament', label: 'Tournament', hint: 'Swiss pairing', roles: ['admin', 'parent'] },
  { id: 'settings', label: 'White-label', hint: 'Brand & coaches', roles: ['admin'] },
]

export function Sidebar({
  current,
  onChange,
  studentCount,
  user,
  branding,
  onLogout,
}: SidebarProps) {
  const links = allLinks.filter((link) => link.roles.includes(user.role))
  const displayName = branding?.displayName || 'Agm-Chess Classes'
  const logoUrl = branding?.logoUrl || ''

  return (
    <aside className="sidebar">
      <div className="brand">
        {logoUrl ? (
          <img className="brand-logo" src={logoUrl} alt="" />
        ) : (
          <span className="brand-mark" aria-hidden="true" />
        )}
        <div>
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
          >
            <span className="nav-label">{link.label}</span>
            <span className="nav-hint">{link.hint}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-foot">
        <p className="sidebar-stat">{studentCount} students</p>
        <p className="sidebar-note">
          Signed in as {user.username} ({user.role})
        </p>
        <div className="auth-actions">
          <button type="button" className="btn small ghost" onClick={onLogout}>
            Logout
          </button>
          <button
            type="button"
            className="btn small primary"
            onClick={onLogout}
            title="Logout and open login screen"
          >
            Login
          </button>
        </div>
      </div>
    </aside>
  )
}
