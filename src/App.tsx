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

  const branding = whiteLabel.branding ?? user.branding

  return (
    <div className="app-shell">
      <Sidebar
        current={view}
        onChange={setView}
        studentCount={students.length}
        user={user}
        branding={branding}
        onLogout={onLogout}
      />
      <main className="main">
        <div className="top-auth-bar">
          <p className="muted compact">
            {user.username} · {user.role}
            {branding?.displayName ? ` · ${branding.displayName}` : ''}
          </p>
          <div className="auth-actions">
            <button type="button" className="btn small ghost" onClick={onLogout}>
              Logout
            </button>
            <button
              type="button"
              className="btn small primary"
              onClick={onLogout}
              title="Go to login screen"
            >
              Login
            </button>
          </div>
        </div>

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
          />
        ) : null}

        {!loading && !error && isAdmin && view === 'attendance' ? (
          <AttendanceView
            students={students}
            onMark={markAttendance}
            onMarkAll={markAllAttendance}
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
            onRecordRenewal={(id, amount, date, note) =>
              addPayment(id, amount, date, note, true)
            }
            onGoFees={() => setView('fees')}
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
  const { user, checking, login, logout } = useAuth()

  if (checking) {
    return (
      <div className="login-screen">
        <p className="muted">Checking session…</p>
      </div>
    )
  }

  if (!user) {
    return <LoginScreen onLogin={login} />
  }

  return (
    <ToastProvider>
      <AuthenticatedApp user={user} onLogout={logout} />
    </ToastProvider>
  )
}

export default App
