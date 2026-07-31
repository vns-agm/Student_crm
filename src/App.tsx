import { useEffect, useState } from 'react'
import { AddStudentView } from './components/AddStudentView'
import { AttendanceView } from './components/AttendanceView'
import { FeesView } from './components/FeesView'
import { LoginScreen } from './components/LoginScreen'
import { Overview } from './components/Overview'
import { Sidebar } from './components/Sidebar'
import { StudentsView } from './components/StudentsView'
import { ToastProvider } from './components/ToastProvider'
import { useAuth } from './hooks/useAuth'
import { useStudents } from './hooks/useStudents'
import type { View } from './types'
import './App.css'

function AuthenticatedApp({
  user,
  onLogout,
}: {
  user: { id: string; username: string; role: 'admin' | 'parent' }
  onLogout: () => void
}) {
  const [view, setView] = useState<View>('overview')
  const isAdmin = user.role === 'admin'
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

  useEffect(() => {
    if (!isAdmin && view !== 'overview') {
      setView('overview')
    }
  }, [isAdmin, view])

  return (
    <div className="app-shell">
      <Sidebar
        current={view}
        onChange={setView}
        studentCount={students.length}
        user={user}
        onLogout={onLogout}
      />
      <main className="main">
        <div className="top-auth-bar">
          <p className="muted compact">
            {user.username} · {user.role}
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
            onAddPayment={addPayment}
            onDeletePayment={deletePayment}
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
