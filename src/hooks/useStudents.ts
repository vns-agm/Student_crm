import { useCallback, useEffect, useState } from 'react'
import { getAuthToken } from './useAuth'
import type { AttendanceStatus, Student, StudentDetailsInput } from '../types'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken()
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
    ...options,
  })

  if (!res.ok) {
    let message = 'Something went wrong.'
    try {
      const body = (await res.json()) as { error?: string }
      if (body.error) message = body.error
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(message)
  }

  if (res.status === 204) {
    return undefined as T
  }

  return (await res.json()) as T
}

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
    status: AttendanceStatus,
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
  ) {
    const updated = await request<Student>(
      `/api/students/${studentId}/payments`,
      {
        method: 'POST',
        body: JSON.stringify({ amount, date, note }),
      },
    )
    setStudents((prev) => prev.map((s) => (s.id === studentId ? updated : s)))
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

export function attendanceRate(student: Student): number {
  if (student.attendance.length === 0) return 0
  const present = student.attendance.filter(
    (a) => a.status === 'present' || a.status === 'late',
  ).length
  return Math.round((present / student.attendance.length) * 100)
}
