import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useToast } from './ToastProvider'
import type { TenantBranding, TenantUser } from '../types'

interface WhiteLabelSettingsProps {
  branding: TenantBranding | null
  users: TenantUser[]
  loading: boolean
  error: string
  onUpdateBranding: (payload: {
    displayName: string
    logoUrl: string
    primaryColor: string
    accentColor: string
  }) => Promise<unknown>
  onCreateParent: (username: string, password: string) => Promise<unknown>
  onCreateCoach: (payload: {
    academyName: string
    adminUsername: string
    adminPassword: string
    parentUsername?: string
    parentPassword?: string
    primaryColor: string
    accentColor: string
  }) => Promise<{
    tenant: TenantBranding
    coach: { username: string }
    parent: { username: string } | null
  }>
  onDeleteParent: (id: string) => Promise<unknown>
}

export function WhiteLabelSettings({
  branding,
  users,
  loading,
  error,
  onUpdateBranding,
  onCreateParent,
  onCreateCoach,
  onDeleteParent,
}: WhiteLabelSettingsProps) {
  const { showToast } = useToast()
  const [displayName, setDisplayName] = useState(branding?.displayName ?? '')
  const [logoUrl, setLogoUrl] = useState(branding?.logoUrl ?? '')
  const [primaryColor, setPrimaryColor] = useState(branding?.primaryColor ?? '#1a4d3e')
  const [accentColor, setAccentColor] = useState(branding?.accentColor ?? '#b8892c')

  const [parentUsername, setParentUsername] = useState('')
  const [parentPassword, setParentPassword] = useState('')

  const [academyName, setAcademyName] = useState('')
  const [coachUsername, setCoachUsername] = useState('')
  const [coachPassword, setCoachPassword] = useState('')
  const [coachParentUsername, setCoachParentUsername] = useState('')
  const [coachParentPassword, setCoachParentPassword] = useState('')
  const [coachPrimary, setCoachPrimary] = useState('#1a4d3e')
  const [coachAccent, setCoachAccent] = useState('#b8892c')

  useEffect(() => {
    if (!branding) return
    setDisplayName(branding.displayName)
    setLogoUrl(branding.logoUrl)
    setPrimaryColor(branding.primaryColor)
    setAccentColor(branding.accentColor)
  }, [branding])

  const parents = users.filter((u) => u.role === 'parent')

  async function handleBranding(e: FormEvent) {
    e.preventDefault()
    try {
      await onUpdateBranding({
        displayName: displayName.trim(),
        logoUrl: logoUrl.trim(),
        primaryColor,
        accentColor,
      })
      showToast('White-label branding saved', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save branding.', 'error')
    }
  }

  async function handleParent(e: FormEvent) {
    e.preventDefault()
    try {
      await onCreateParent(parentUsername.trim(), parentPassword)
      setParentUsername('')
      setParentPassword('')
      showToast('Parent login created for your CRM', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not create parent.', 'error')
    }
  }

  async function handleCoach(e: FormEvent) {
    e.preventDefault()
    try {
      const created = await onCreateCoach({
        academyName: academyName.trim(),
        adminUsername: coachUsername.trim(),
        adminPassword: coachPassword,
        parentUsername: coachParentUsername.trim() || undefined,
        parentPassword: coachParentPassword || undefined,
        primaryColor: coachPrimary,
        accentColor: coachAccent,
      })
      setAcademyName('')
      setCoachUsername('')
      setCoachPassword('')
      setCoachParentUsername('')
      setCoachParentPassword('')
      const parentNote = created.parent
        ? ` Parent login: ${created.parent.username}`
        : ''
      showToast(
        `Coach CRM created for ${created.tenant.displayName}. Coach: ${created.coach.username}.${parentNote}`,
        'success',
      )
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not create coach CRM.', 'error')
    }
  }

  if (loading) {
    return (
      <section className="panel">
        <p className="muted">Loading white-label settings…</p>
      </section>
    )
  }

  if (error) {
    return (
      <section className="panel">
        <div className="banner-error">
          <p>{error}</p>
        </div>
      </section>
    )
  }

  return (
    <section className="panel">
      <header className="panel-header">
        <div>
          <h1>White-label</h1>
          <p className="muted">
            Brand your CRM, add parent logins for your academy, and provision
            separate CRMs for other coaches.
          </p>
        </div>
      </header>

      <form className="form-card" onSubmit={handleBranding}>
        <h2>Your branding</h2>
        <div className="form-row two-col">
          <label>
            Academy display name
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your Chess Academy"
              required
            />
          </label>
          <label>
            Logo URL (optional)
            <input
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://…"
            />
          </label>
        </div>
        <div className="form-row two-col">
          <label>
            Primary color
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
            />
          </label>
          <label>
            Accent color
            <input
              type="color"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
            />
          </label>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn primary">
            Save branding
          </button>
        </div>
      </form>

      <div className="fees-layout">
        <form className="form-card" onSubmit={handleParent}>
          <h2>Parent login (your CRM)</h2>
          <p className="muted compact">
            Parents only see standings and overview for this academy.
          </p>
          <label>
            Username
            <input
              value={parentUsername}
              onChange={(e) => setParentUsername(e.target.value)}
              placeholder="parent_smith"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={parentPassword}
              onChange={(e) => setParentPassword(e.target.value)}
              placeholder="At least 6 characters"
              required
            />
          </label>
          <div className="form-actions">
            <button type="submit" className="btn primary">
              Create parent login
            </button>
          </div>
        </form>

        <div className="form-card">
          <h2>Logins on your CRM</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Role</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="empty-cell">
                      No users yet.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id}>
                      <td className="name-cell">{u.username}</td>
                      <td>
                        <span className="pill">{u.role}</span>
                      </td>
                      <td className="row-actions">
                        {u.role === 'parent' ? (
                          <button
                            type="button"
                            className="btn small danger"
                            onClick={async () => {
                              if (!confirm(`Remove parent login ${u.username}?`)) return
                              try {
                                await onDeleteParent(u.id)
                                showToast('Parent login removed', 'success')
                              } catch (err) {
                                showToast(
                                  err instanceof Error ? err.message : 'Could not delete.',
                                  'error',
                                )
                              }
                            }}
                          >
                            Remove
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="muted compact">
            {parents.length} parent login{parents.length === 1 ? '' : 's'} linked to your CRM.
          </p>
        </div>
      </div>

      <form className="form-card" onSubmit={handleCoach}>
        <h2>Give app to another coach</h2>
        <p className="muted compact">
          Creates a separate CRM with its own students, fees, tournaments, and
          parent logins. Your data stays private.
        </p>
        <div className="form-row two-col">
          <label>
            Coach academy name
            <input
              value={academyName}
              onChange={(e) => setAcademyName(e.target.value)}
              placeholder="Knight Moves Academy"
              required
            />
          </label>
          <label>
            Coach admin username
            <input
              value={coachUsername}
              onChange={(e) => setCoachUsername(e.target.value)}
              placeholder="coach_alex"
              required
            />
          </label>
        </div>
        <div className="form-row two-col">
          <label>
            Coach admin password
            <input
              type="password"
              value={coachPassword}
              onChange={(e) => setCoachPassword(e.target.value)}
              placeholder="At least 6 characters"
              required
            />
          </label>
          <label>
            Their primary color
            <input
              type="color"
              value={coachPrimary}
              onChange={(e) => setCoachPrimary(e.target.value)}
            />
          </label>
        </div>
        <div className="form-row two-col">
          <label>
            Parent username (optional)
            <input
              value={coachParentUsername}
              onChange={(e) => setCoachParentUsername(e.target.value)}
              placeholder="parent_alex"
            />
          </label>
          <label>
            Parent password (optional)
            <input
              type="password"
              value={coachParentPassword}
              onChange={(e) => setCoachParentPassword(e.target.value)}
              placeholder="Required if parent username set"
            />
          </label>
        </div>
        <label>
          Their accent color
          <input
            type="color"
            value={coachAccent}
            onChange={(e) => setCoachAccent(e.target.value)}
          />
        </label>
        <div className="form-actions">
          <button type="submit" className="btn primary">
            Create coach CRM
          </button>
        </div>
      </form>
    </section>
  )
}
