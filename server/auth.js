import crypto from 'node:crypto'
import { runWithDemoDb } from './db.js'

// Signs login tokens. A public default would let anyone forge an admin token.
const AUTH_SECRET = process.env.AUTH_SECRET?.trim() || 'local-development-only'
if (process.env.VERCEL && !process.env.AUTH_SECRET?.trim()) {
  throw new Error('AUTH_SECRET must be set in Vercel → Settings → Environment Variables.')
}

// Fixed so stored password hashes keep working; independent of AUTH_SECRET.
const PASSWORD_SALT = 'agm-chess-classes-dev-secret'
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7 // 7 days

export function hashPassword(password) {
  return crypto
    .createHash('sha256')
    .update(`${password}:${PASSWORD_SALT}`)
    .digest('hex')
}

export function createToken(user) {
  const payload = {
    sub: user.id,
    username: user.username,
    role: user.role,
    tenantId: user.tenant_id || user.tenantId,
    isOwner: Boolean(user.is_owner ?? user.isOwner),
    demo: Boolean(user.demo),
    exp: Date.now() + TOKEN_TTL_MS,
  }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(body)
    .digest('base64url')
  return `${body}.${sig}`
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return null
  }

  const [body, sig] = token.split('.')
  const expected = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(body)
    .digest('base64url')

  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null
  }

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (!payload?.exp || payload.exp < Date.now()) return null
    if (!payload.sub || !payload.username || !payload.role || !payload.tenantId) {
      return null
    }
    return payload
  } catch {
    return null
  }
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  const payload = verifyToken(token)

  if (!payload) {
    return res.status(401).json({ error: 'Please log in to continue.' })
  }

  req.user = {
    id: payload.sub,
    username: payload.username,
    role: payload.role,
    tenantId: payload.tenantId,
    isOwner: Boolean(payload.isOwner),
    isDemo: Boolean(payload.demo),
  }

  if (req.user.isDemo) {
    try {
      runWithDemoDb(next)
    } catch (error) {
      next(error)
    }
    return
  }
  next()
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' })
  }
  next()
}

export function requireOwner(req, res, next) {
  if (req.user?.role !== 'admin' || !req.user?.isOwner) {
    return res.status(403).json({ error: 'Platform owner access required.' })
  }
  next()
}
