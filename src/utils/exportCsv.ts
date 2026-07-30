import { attendanceRate, balanceDue, totalPaid } from '../hooks/useStudents'
import { BATCH_OPTIONS } from '../types'
import type { Batch, Student } from '../types'

function batchLabel(batch: Batch) {
  return BATCH_OPTIONS.find((o) => o.value === batch)?.label ?? batch
}

function escapeCsv(value: string | number) {
  const text = String(value)
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export function exportStudentsToCsv(students: Student[]) {
  const headers = [
    'Name',
    'Age',
    'Batch',
    'Payment Date',
    'Number of Classes',
    'Fees Per Class',
    'Total Fees',
    'Amount Paid',
    'Extra Payments',
    'Total Paid',
    'Balance',
    'Attendance %',
    'Classes Held',
    'Created At',
  ]

  const rows = students.map((student) => {
    const extraPayments = student.payments.reduce((sum, p) => sum + p.amount, 0)
    const classesHeld = student.attendance.filter(
      (a) => a.status === 'present' || a.status === 'late',
    ).length

    return [
      student.name,
      student.age,
      batchLabel(student.batch),
      student.paymentDate,
      student.numberOfClasses,
      student.feesPerClass,
      student.totalFees,
      student.amountPaid,
      extraPayments,
      totalPaid(student),
      balanceDue(student),
      attendanceRate(student),
      classesHeld,
      student.createdAt,
    ]
  })

  const csv = [headers, ...rows]
    .map((row) => row.map(escapeCsv).join(','))
    .join('\n')

  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const date = new Date().toISOString().slice(0, 10)
  link.href = url
  link.download = `student-crm-${date}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
