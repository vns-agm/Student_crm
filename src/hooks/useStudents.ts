import { useCallback, useEffect, useState } from 'react'
import { request } from '../api'
import type { AttendanceStatus, Student, StudentDetailsInput } from '../types'
import { SESSIONS_PER_CYCLE } from '../types'

export function useStudents() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setError('')
    try {
      const data = await request<Student[]>('/api/students')
      setStudents(data)
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Could not load students from the database.'
      setError(message)
      throw err
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        setLoading(true)
        await refresh()
      } catch {
        // error already stored in state
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [refresh])

  async function addStudent(details: StudentDetailsInput) {
    const created = await request<Student>('/api/students', {
      method: 'POST',
      body: JSON.stringify(details),
    })
    setStudents((prev) => [created, ...prev])
    return created
  }

  async function updateStudent(id: string, details: StudentDetailsInput) {
    const updated = await request<Student>(`/api/students/${id}`, {
      method: 'PUT',
      body: JSON.stringify(details),
    })
    setStudents((prev) => prev.map((s) => (s.id === id ? updated : s)))
  }

  async function deleteStudent(id: string) {
    await request<void>(`/api/students/${id}`, { method: 'DELETE' })
    setStudents((prev) => prev.filter((s) => s.id !== id))
  }

  async function markAttendance(
    studentId: string,
    date: string,
    status: AttendanceStatus | null,
  ) {
    const updated = await request<Student>(
      `/api/students/${studentId}/attendance`,
      {
        method: 'PUT',
        body: JSON.stringify({ date, status }),
      },
    )
    setStudents((prev) => prev.map((s) => (s.id === studentId ? updated : s)))
  }

  async function markAllAttendance(date: string, status: AttendanceStatus) {
    const updated = await request<Student[]>('/api/attendance/bulk', {
      method: 'PUT',
      body: JSON.stringify({ date, status }),
    })
    setStudents(updated)
  }

  async function addPayment(
    studentId: string,
    amount: number,
    date: string,
    note: string,
    isRenewal = false,
  ) {
    const updated = await request<Student>(
      `/api/students/${studentId}/payments`,
      {
        method: 'POST',
        body: JSON.stringify({ amount, date, note, isRenewal }),
      },
    )
    setStudents((prev) => prev.map((s) => (s.id === studentId ? updated : s)))
    return updated
  }

  async function deletePayment(studentId: string, paymentId: string) {
    const updated = await request<Student>(`/api/payments/${paymentId}`, {
      method: 'DELETE',
    })
    setStudents((prev) => prev.map((s) => (s.id === studentId ? updated : s)))
  }

  return {
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
  }
}

export function totalPaid(student: Student): number {
  const extraPayments = student.payments.reduce((sum, p) => sum + p.amount, 0)
  return student.amountPaid + extraPayments
}

export function balanceDue(student: Student): number {
  return Math.max(0, student.totalFees - totalPaid(student))
}

export function classesHeld(student: Student): number {
  return student.attendance.filter(
    (a) => a.status === 'present' || a.status === 'late',
  ).length
}

export function sessionsInCycle(student: Student): number {
  if (typeof student.sessionsInCycle === 'number') {
    return student.sessionsInCycle
  }
  return Math.max(0, classesHeld(student) - (student.cycleStartClasses ?? 0))
}

export function isRenewalPending(student: Student): boolean {
  if (typeof student.renewalPending === 'boolean') {
    return student.renewalPending
  }
  return sessionsInCycle(student) >= SESSIONS_PER_CYCLE
}

export function renewalCount(student: Student): number {
  if (typeof student.renewalCount === 'number') {
    return student.renewalCount
  }
  return student.renewals?.length ?? 0
}

export { SESSIONS_PER_CYCLE }

export function attendanceRate(student: Student): number {
  if (student.attendance.length === 0) return 0
  return Math.round((classesHeld(student) / student.attendance.length) * 100)
}
