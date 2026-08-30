import type { FeePayment, Student, TenantBranding } from '../types'

interface ReceiptInput {
  student: Student
  payment: FeePayment
  branding: TenantBranding | null | undefined
  renewalNumber?: number
  isRenewal?: boolean
}

const SCALE = 2
const W = 400
const PAD = 28

function formatDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatMoney(amount: number) {
  return `₹${amount.toLocaleString('en-IN')}`
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines.length ? lines : [text]
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
  const isRenewalPayment = Boolean(isRenewal || payment.isRenewal)

  const rows: { label: string; value: string }[] = [
    { label: 'Student', value: student.name },
    { label: 'Batch', value: capitalize(student.batch) },
    {
      label: 'Class package',
      value: `${student.numberOfClasses} sessions`,
    },
    { label: 'Payment mode', value: 'Cash / UPI' },
  ]

  if (isRenewalPayment) {
    rows.push({
      label: 'Renewal number',
      value: `#${renewalNumber ?? student.renewalCount ?? 1}`,
    })
  }

  if (payment.note.trim()) {
    rows.push({ label: 'Note', value: payment.note.trim() })
  }

  rows.push({
    label: 'Receipt no.',
    value: payment.id.slice(0, 8).toUpperCase(),
  })

  const rowHeight = 52
  const headerH = 148
  const amountBlockH = 88
  const footerH = 72
  const bodyPad = 20
  const bodyH = bodyPad * 2 + rows.length * rowHeight + amountBlockH + 16
  const H = headerH + bodyH + footerH + PAD

  const canvas = document.createElement('canvas')
  canvas.width = W * SCALE
  canvas.height = H * SCALE
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.scale(SCALE, SCALE)

  // Outer background
  ctx.fillStyle = '#e8efe9'
  ctx.fillRect(0, 0, W, H)

  // Main ticket
  const ticketX = 16
  const ticketY = 16
  const ticketW = W - 32
  const ticketH = H - 32

  ctx.fillStyle = '#ffffff'
  roundRect(ctx, ticketX, ticketY, ticketW, ticketH, 20)
  ctx.fill()
  ctx.shadowColor = 'rgba(20, 36, 28, 0.12)'
  ctx.shadowBlur = 24
  ctx.shadowOffsetY = 8
  roundRect(ctx, ticketX, ticketY, ticketW, ticketH, 20)
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0

  // Header
  const hx = ticketX
  const hy = ticketY
  const hw = ticketW
  const hh = headerH

  const headerGrad = ctx.createLinearGradient(hx, hy, hx + hw, hy + hh)
  headerGrad.addColorStop(0, primary)
  headerGrad.addColorStop(1, '#0f3329')
  ctx.fillStyle = headerGrad
  roundRectTop(ctx, hx, hy, hw, hh, 20)
  ctx.fill()

  // Subtle chess grid in header
  ctx.globalAlpha = 0.08
  const cell = 18
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < Math.ceil(hw / cell); c++) {
      if ((r + c) % 2 === 0) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(hx + c * cell, hy + r * cell, cell, cell)
      }
    }
  }
  ctx.globalAlpha = 1

  ctx.fillStyle = accent
  ctx.fillRect(hx, hy + hh - 3, hw, 3)

  // Logo circle
  const logoX = hx + hw / 2
  const logoY = hy + 36
  ctx.beginPath()
  ctx.arc(logoX, logoY, 22, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.fillStyle = accent
  ctx.font = '22px serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('♞', logoX, logoY + 1)

  // Academy title
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 20px Georgia, "Times New Roman", serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  const titleLines = wrapText(ctx, academy, hw - 48)
  let titleY = hy + 78
  for (const line of titleLines.slice(0, 2)) {
    ctx.fillText(line, hx + hw / 2, titleY)
    titleY += 24
  }

  ctx.font = '600 11px system-ui, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.88)'
  ctx.fillText('OFFICIAL PAYMENT RECEIPT', hx + hw / 2, titleY + 6)

  // Paid badge
  const badgeW = 58
  const badgeH = 22
  const badgeX = hx + hw - badgeW - 16
  const badgeY = hy + 14
  ctx.fillStyle = accent
  roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 11)
  ctx.fill()
  ctx.fillStyle = '#1a1a1a'
  ctx.font = 'bold 10px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('PAID', badgeX + badgeW / 2, badgeY + 15)

  // Date pill below header
  const dateStr = formatDate(payment.date)
  ctx.font = '500 11px system-ui, sans-serif'
  const dateW = ctx.measureText(dateStr).width + 24
  const dateX = hx + (hw - dateW) / 2
  const dateY = hy + hh - 22
  ctx.fillStyle = 'rgba(255,255,255,0.2)'
  roundRect(ctx, dateX, dateY, dateW, 24, 12)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.fillText(dateStr, hx + hw / 2, dateY + 16)

  // Body area
  let y = hy + hh + bodyPad
  const contentLeft = hx + PAD
  const contentRight = hx + hw - PAD
  const contentW = contentRight - contentLeft

  // Amount hero block
  ctx.fillStyle = `${primary}0f`
  roundRect(ctx, contentLeft, y, contentW, amountBlockH, 14)
  ctx.fill()
  ctx.strokeStyle = `${primary}28`
  ctx.lineWidth = 1
  roundRect(ctx, contentLeft, y, contentW, amountBlockH, 14)
  ctx.stroke()

  ctx.fillStyle = primary
  ctx.font = '600 11px system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('AMOUNT RECEIVED', contentLeft + 18, y + 28)

  ctx.font = 'bold 32px Georgia, "Times New Roman", serif'
  ctx.textAlign = 'right'
  ctx.fillText(formatMoney(payment.amount), contentRight - 18, y + 62)

  if (isRenewalPayment) {
    ctx.font = '600 10px system-ui, sans-serif'
    ctx.fillStyle = accent
    ctx.textAlign = 'left'
    ctx.fillText('PACKAGE RENEWAL', contentLeft + 18, y + 72)
  }

  y += amountBlockH + 20

  // Detail rows
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowY = y + i * rowHeight

    if (i > 0) {
      ctx.strokeStyle = '#e2ebe4'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(contentLeft, rowY)
      ctx.lineTo(contentRight, rowY)
      ctx.stroke()
    }

    ctx.fillStyle = '#6b7f73'
    ctx.font = '600 10px system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(row.label.toUpperCase(), contentLeft, rowY + 22)

    ctx.fillStyle = '#14241c'
    ctx.font = '600 14px system-ui, sans-serif'
    ctx.textAlign = 'right'

    const valueLines = wrapText(ctx, row.value, contentW * 0.58)
    const displayLines = valueLines.slice(0, 2)
    if (displayLines.length === 1) {
      ctx.fillText(displayLines[0], contentRight, rowY + 36)
    } else {
      ctx.font = '600 13px system-ui, sans-serif'
      ctx.fillText(displayLines[0], contentRight, rowY + 30)
      ctx.fillText(displayLines[1], contentRight, rowY + 46)
    }
  }

  // Footer
  const footerY = hy + hh + bodyH
  ctx.fillStyle = '#f3f7f4'
  roundRectBottom(ctx, hx, footerY, hw, footerH + (ticketY + ticketH - footerY - footerH), 20)
  ctx.fill()

  ctx.strokeStyle = '#e2ebe4'
  ctx.beginPath()
  ctx.moveTo(contentLeft, footerY + 12)
  ctx.lineTo(contentRight, footerY + 12)
  ctx.stroke()

  ctx.fillStyle = '#4d6458'
  ctx.font = '500 12px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('Thank you for learning with us!', hx + hw / 2, footerY + 36)

  ctx.fillStyle = primary
  ctx.font = '600 11px Georgia, serif'
  ctx.fillText('♞  Keep playing, keep improving  ♞', hx + hw / 2, footerY + 56)

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

function roundRectTop(
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
  ctx.lineTo(x + w, y + h)
  ctx.lineTo(x, y + h)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function roundRectBottom(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + w, y)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y)
  ctx.closePath()
}
