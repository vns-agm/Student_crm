export type AttendanceStatus = 'present' | 'absent' | 'late'

export type Batch = 'beginner' | 'intermediate' | 'advanced'

export const BATCH_OPTIONS: { value: Batch; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
]

export interface AttendanceRecord {
  id: string
  date: string
  status: AttendanceStatus
}

export interface FeePayment {
  id: string
  amount: number
  date: string
  note: string
}

export interface StudentDetailsInput {
  name: string
  age: number
  paymentDate: string
  numberOfClasses: number
  feesPerClass: number
  amountPaid: number
  batch: Batch
}

export interface Student extends StudentDetailsInput {
  id: string
  totalFees: number
  attendance: AttendanceRecord[]
  payments: FeePayment[]
  createdAt: string
}

export type View =
  | 'overview'
  | 'add-student'
  | 'students'
  | 'attendance'
  | 'fees'

export type UserRole = 'admin' | 'parent'

export interface AuthUser {
  id: string
  username: string
  role: UserRole
}
