import { useEffect, useState } from 'react'
import { AddStudentView } from './components/AddStudentView'
import { AttendanceView } from './components/AttendanceView'
import { FeesView } from './components/FeesView'
import { LoginScreen } from './components/LoginScreen'
import { Overview } from './components/Overview'
import { RenewalView } from './components/RenewalView'
import { Sidebar } from './components/Sidebar'
import { StudentsView } from './components/StudentsView'
import { ToastProvider } from './components/ToastProvider'
import { TournamentView } from './components/TournamentView'
import { WhiteLabelSettings } from './components/WhiteLabelSettings'
import { useAuth } from './hooks/useAuth'
import { useStudents } from './hooks/useStudents'
import { useTournaments } from './hooks/useTournaments'
import { useWhiteLabel } from './hooks/useWhiteLabel'
import type { AuthUser, View } from './types'
import './App.css'

const SIDEBAR_KEY = 'agm-chess-sidebar-collapsed'
const DRAWER_QUERY = '(max-width: 860px)'

function readSidebarCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === '1'
  } catch {
    return false
  }
}

function AuthenticatedApp({
  user,
  onLogout,
}: {
  user: AuthUser
  onLogout: () => void
}) {
  const [view, setView] = useState<View>('overview')
  const isAdmin = user.role === 'admin'
  const isOwner = Boolean(user.isOwner)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed)
  // On phones the sidebar is a slide-in drawer instead of a collapsing rail.
  const [drawerOpen, setDrawerOpen] = useState(false)
  const {
    students,
    loading,
    error,
    refresh,
    addStudent,
    updateStudent,
    deleteStudent,
    markAttendance,
    markAllAttendance,
    moveAttendance,
    deletePackage,
    addPayment,
    deletePayment,
  } = useStudents()
  const {
    tournaments,
    loading: tournamentsLoading,
    error: tournamentsError,
    createTournament,
    deleteTournament,
    addPlayer,
    removePlayer,
    pairRound,
    setResult,
  } = useTournaments()
  const whiteLabel = useWhiteLabel(isOwner)

  useEffect(() => {
    if (!isAdmin && view !== 'overview' && view !== 'tournament') {
      setView('overview')
    }
    if (isAdmin && !isOwner && view === 'settings') {
      setView('overview')
    }
  }, [isAdmin, isOwner, view])

  useEffect(() => {
    if (!drawerOpen) return
    const closeOnEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [drawerOpen])

  function toggleSidebar() {
    if (window.matchMedia(DRAWER_QUERY).matches) {
      setDrawerOpen((open) => !open)
      return
    }
    const next = !sidebarCollapsed
    setSidebarCollapsed(next)
    try {
      localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0')
    } catch {
      // Remembering the choice is optional.
    }
  }

  const branding = whiteLabel.branding ?? user.branding
  const sidebarIsOpen = window.matchMedia(DRAWER_QUERY).matches ? drawerOpen : !sidebarCollapsed

  return (
    <div
      className={`app-shell${sidebarCollapsed ? ' sidebar-collapsed' : ''}${drawerOpen ? ' drawer-open' : ''}`}
    >
      <Sidebar
        current={view}
        onChange={(next) => {
          setView(next)
          setDrawerOpen(false)
        }}
        studentCount={students.length}
        user={user}
        branding={branding}
      />
      <button
        type="button"
        className="drawer-backdrop"
        aria-label="Close menu"
        tabIndex={drawerOpen ? 0 : -1}
        onClick={() => setDrawerOpen(false)}
      />
      <main className="main">
        <div className="top-auth-bar">
          <div className="top-bar-start">
            <button
              type="button"
              className="sidebar-toggle"
              onClick={toggleSidebar}
              aria-label={sidebarIsOpen ? 'Close sidebar' : 'Open sidebar'}
              aria-expanded={sidebarIsOpen}
              title={sidebarIsOpen ? 'Close sidebar' : 'Open sidebar'}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <p className="muted compact">
              {user.username} · {user.role}
              {branding?.displayName ? ` · ${branding.displayName}` : ''}
            </p>
          </div>
          <button type="button" className="btn small ghost" onClick={onLogout}>
            Logout
          </button>
        </div>

        {user.isDemo ? (
          <p className="demo-banner">
            <strong>Demo mode:</strong> you're viewing sample data. Changes are reset every few hours.
          </p>
        ) : null}

        {loading ? (
          <section className="panel">
            <p className="muted">Loading students from the database…</p>
          </section>
        ) : null}

        {!loading && error ? (
          <section className="panel">
            <div className="banner-error">
              <p>{error}</p>
              <p className="muted compact">
                {import.meta.env.PROD
                  ? 'On Vercel, set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in Project Settings → Environment Variables, then redeploy. Locally, run npm run dev.'
                  : 'Make sure the API is running (`npm run dev` starts both the database API and the app).'}
              </p>
              <button
                type="button"
                className="btn primary"
                onClick={() => void refresh()}
              >
                Retry
              </button>
            </div>
          </section>
        ) : null}

        {!loading && !error && view === 'overview' ? (
          <Overview
            students={students}
            readOnly={!isAdmin}
            onGoAdd={() => setView('add-student')}
            onGoStudents={() => setView('students')}
            onGoAttendance={() => setView('attendance')}
            onGoFees={() => setView('fees')}
            onGoRenewal={() => setView('renewal')}
            onDelete={deleteStudent}
            onMoveAttendance={isAdmin ? moveAttendance : undefined}
            onDeletePackage={isAdmin ? deletePackage : undefined}
          />
        ) : null}

        {!loading && !error && isAdmin && view === 'add-student' ? (
          <AddStudentView
            onAdd={addStudent}
            onGoStudents={() => setView('students')}
          />
        ) : null}

        {!loading && !error && isAdmin && view === 'students' ? (
          <StudentsView
            students={students}
            onUpdate={updateStudent}
            onDelete={deleteStudent}
            onGoAdd={() => setView('add-student')}
            onMoveAttendance={moveAttendance}
            onDeletePackage={deletePackage}
          />
        ) : null}

        {!loading && !error && isAdmin && view === 'attendance' ? (
          <AttendanceView
            students={students}
            onMark={markAttendance}
            onMarkAll={markAllAttendance}
            onGoRenewal={() => setView('renewal')}
            onMoveAttendance={moveAttendance}
            onDeletePackage={deletePackage}
          />
        ) : null}

        {!loading && !error && isAdmin && view === 'fees' ? (
          <FeesView
            students={students}
            branding={branding}
            onAddPayment={addPayment}
            onDeletePayment={deletePayment}
          />
        ) : null}

        {!loading && !error && isAdmin && view === 'renewal' ? (
          <RenewalView
            students={students}
            branding={branding}
            onRecordRenewal={(id, amount, date, note, numberOfClasses) =>
              addPayment(id, amount, date, note, true, numberOfClasses)
            }
            onGoFees={() => setView('fees')}
            onDeletePackage={deletePackage}
          />
        ) : null}

        {!loading && !error && view === 'tournament' ? (
          <TournamentView
            students={students}
            tournaments={tournaments}
            loading={tournamentsLoading}
            error={tournamentsError}
            readOnly={!isAdmin}
            onCreate={createTournament}
            onDelete={deleteTournament}
            onAddPlayer={addPlayer}
            onRemovePlayer={removePlayer}
            onPair={pairRound}
            onSetResult={setResult}
          />
        ) : null}

        {!loading && !error && isOwner && view === 'settings' ? (
          <WhiteLabelSettings
            branding={whiteLabel.branding}
            users={whiteLabel.users}
            loading={whiteLabel.loading}
            error={whiteLabel.error}
            onUpdateBranding={whiteLabel.updateBranding}
            onCreateParent={whiteLabel.createParent}
            onCreateCoach={whiteLabel.createCoach}
            onDeleteParent={whiteLabel.deleteParent}
          />
        ) : null}
      </main>
    </div>
  )
}

function App() {
  const { user, checking, login, loginDemo, logout } = useAuth()

  if (checking) {
    return (
      <div className="login-screen">
        <p className="muted">Checking session…</p>
      </div>
    )
  }

  if (!user) {
    return <LoginScreen onLogin={login} onDemoLogin={loginDemo} />
  }

  return (
    <ToastProvider>
      <AuthenticatedApp user={user} onLogout={logout} />
    </ToastProvider>
  )
}

export default App
