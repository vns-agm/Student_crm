import { useCallback, useEffect, useState } from 'react'
import type { AuthUser } from '../types'
import { applyBranding } from '../utils/branding'

const STORAGE_KEY = 'agm-chess-auth'

interface StoredAuth {
  token: string
  user: AuthUser
}

function readStoredAuth(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredAuth
    if (!parsed?.token || !parsed?.user?.role) return null
    return parsed
  } catch {
    return null
  }
}

export function getAuthToken() {
  return readStoredAuth()?.token ?? ''
}

export function useAuth() {
  const [auth, setAuth] = useState<StoredAuth | null>(() => readStoredAuth())
  const [checking, setChecking] = useState(Boolean(readStoredAuth()))

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setAuth(null)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function validate() {
      const stored = readStoredAuth()
      if (!stored) {
        setChecking(false)
        return
      }

      try {
        const res = await fetch('/api/me', {
          headers: { Authorization: `Bearer ${stored.token}` },
        })
        if (!res.ok) {
          throw new Error('Session expired')
        }
        const body = (await res.json()) as { user: AuthUser }
        if (!cancelled) {
          const next = { token: stored.token, user: body.user }
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
          setAuth(next)
          applyBranding(body.user.branding)
        }
      } catch {
        if (!cancelled) {
          localStorage.removeItem(STORAGE_KEY)
          setAuth(null)
        }
      } finally {
        if (!cancelled) setChecking(false)
      }
    }

    void validate()
    return () => {
      cancelled = true
    }
  }, [])

  async function login(username: string, password: string) {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })

    let message = 'Could not log in.'
    try {
      const body = (await res.json()) as {
        error?: string
        token?: string
        user?: AuthUser
      }
      if (!res.ok) {
        throw new Error(body.error || message)
      }
      if (!body.token || !body.user) {
        throw new Error(message)
      }
      const next = { token: body.token, user: body.user }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      setAuth(next)
      applyBranding(body.user.branding)
      return body.user
    } catch (err) {
      if (err instanceof Error) throw err
      throw new Error(message)
    }
  }

  return {
    user: auth?.user ?? null,
    token: auth?.token ?? '',
    checking,
    isAdmin: auth?.user?.role === 'admin',
    isParent: auth?.user?.role === 'parent',
    login,
    logout,
  }
}
