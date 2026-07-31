import { useState } from 'react'
import { AddStudentView } from './components/AddStudentView'
import { AttendanceView } from './components/AttendanceView'
import { FeesView } from './components/FeesView'
import { Overview } from './components/Overview'
import { Sidebar } from './components/Sidebar'
import { StudentsView } from './components/StudentsView'
import { useStudents } from './hooks/useStudents'
import type { View } from './types'
import './App.css'

function App() {
  const [view, setView] = useState<View>('overview')
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

  return (
    <div className="app-shell">
      <Sidebar
        current={view}
        onChange={setView}
        studentCount={students.length}
      />
      <main className="main">
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
              <button type="button" className="btn primary" onClick={() => void refresh()}>
                Retry
              </button>
            </div>
          </section>
        ) : null}

        {!loading && !error && view === 'overview' ? (
          <Overview
            students={students}
            onGoAdd={() => setView('add-student')}
            onGoStudents={() => setView('students')}
            onGoAttendance={() => setView('attendance')}
            onGoFees={() => setView('fees')}
            onDelete={deleteStudent}
          />
        ) : null}

        {!loading && !error && view === 'add-student' ? (
          <AddStudentView
            onAdd={addStudent}
            onGoStudents={() => setView('students')}
          />
        ) : null}

        {!loading && !error && view === 'students' ? (
          <StudentsView
            students={students}
            onUpdate={updateStudent}
            onDelete={deleteStudent}
            onGoAdd={() => setView('add-student')}
          />
        ) : null}

        {!loading && !error && view === 'attendance' ? (
          <AttendanceView
            students={students}
            onMark={markAttendance}
            onMarkAll={markAllAttendance}
          />
        ) : null}

        {!loading && !error && view === 'fees' ? (
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

export default App
