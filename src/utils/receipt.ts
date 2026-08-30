import type { FeePayment, Student, TenantBranding } from '../types'

interface ReceiptInput {
  student: Student
  payment: FeePayment
  branding: TenantBranding | null | undefined
  renewalNumber?: number
  isRenewal?: boolean
}

function formatDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatMoney(amount: number) {
  return `₹${amount.toLocaleString('en-IN')}`
}

export async function downloadPaymentReceipt({
  student,
  payment,
  branding,
  renewalNumber,
  isRenewal,
}: ReceiptInput) {
  const academy = branding?.displayName || 'Chess Academy'
  const primary = branding?.primaryColor || '#1a4d3e'
  const accent = branding?.accentColor || '#b8892c'

  const width = 420
  const height = 620
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // Background
  ctx.fillStyle = '#f7faf7'
  ctx.fillRect(0, 0, width, height)

  // Header band
  const gradient = ctx.createLinearGradient(0, 0, width, 120)
  gradient.addColorStop(0, primary)
  gradient.addColorStop(1, '#0f3329')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, 120)

  // Accent stripe
  ctx.fillStyle = accent
  ctx.fillRect(0, 118, width, 4)

  // Academy name
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 22px Georgia, serif'
  ctx.textAlign = 'center'
  ctx.fillText(academy, width / 2, 48)

  ctx.font = '600 13px sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.fillText('Payment Receipt', width / 2, 72)

  ctx.font = '500 11px sans-serif'
  ctx.fillText(formatDate(payment.date), width / 2, 96)

  // Card body
  ctx.fillStyle = '#ffffff'
  roundRect(ctx, 24, 140, width - 48, 420, 16)
  ctx.fill()
  ctx.strokeStyle = '#c5d4cb'
  ctx.lineWidth = 1
  roundRect(ctx, 24, 140, width - 48, 420, 16)
  ctx.stroke()

  let y = 175
  const left = 48
  const right = width - 48

  drawRow(ctx, left, right, y, 'Student', student.name)
  y += 36
  drawRow(ctx, left, right, y, 'Batch', student.batch)
  y += 36
  drawRow(ctx, left, right, y, 'Classes package', `${student.numberOfClasses} sessions`)
  y += 44

  // Amount highlight
  ctx.fillStyle = `${primary}18`
  roundRect(ctx, left, y - 8, right - left, 56, 10)
  ctx.fill()
  ctx.fillStyle = primary
  ctx.font = '600 12px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('Amount received', left + 16, y + 14)
  ctx.font = 'bold 26px Georgia, serif'
  ctx.textAlign = 'right'
  ctx.fillText(formatMoney(payment.amount), right - 16, y + 36)
  y += 72

  if (isRenewal || payment.isRenewal) {
    drawRow(
      ctx,
      left,
      right,
      y,
      'Renewal #',
      String(renewalNumber ?? student.renewalCount ?? 1),
    )
    y += 36
  }

  drawRow(ctx, left, right, y, 'Payment mode', 'Cash / UPI')
  y += 36
  if (payment.note) {
    drawRow(ctx, left, right, y, 'Note', payment.note)
    y += 36
  }

  drawRow(ctx, left, right, y, 'Receipt ID', payment.id.slice(0, 8).toUpperCase())

  // Footer
  ctx.fillStyle = '#4d6458'
  ctx.font = '500 11px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('Thank you for learning with us!', width / 2, 590)
  ctx.fillStyle = accent
  ctx.font = '600 12px sans-serif'
  ctx.fillText('♞ Keep playing, keep improving', width / 2, 610)

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png'),
  )
  if (!blob) return

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${academy.replace(/\s+/g, '-')}-receipt-${student.name.replace(/\s+/g, '-')}-${payment.date}.png`
  link.click()
  URL.revokeObjectURL(url)
}

function drawRow(
  ctx: CanvasRenderingContext2D,
  left: number,
  right: number,
  y: number,
  label: string,
  value: string,
) {
  ctx.fillStyle = '#4d6458'
  ctx.font = '600 11px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(label.toUpperCase(), left, y)
  ctx.fillStyle = '#14241c'
  ctx.font = '600 14px sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText(value, right, y + 18)
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}
