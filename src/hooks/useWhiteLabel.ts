import { useCallback, useEffect, useState } from 'react'
import { applyBranding } from '../utils/branding'
import type { TenantBranding, TenantUser } from '../types'
import { request } from '../api'

export { applyBranding }

export function useWhiteLabel(isAdmin: boolean) {
  const [branding, setBranding] = useState<TenantBranding | null>(null)
  const [users, setUsers] = useState<TenantUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    const nextBranding = await request<TenantBranding>('/api/branding')
    setBranding(nextBranding)
    applyBranding(nextBranding)

    if (isAdmin) {
      const nextUsers = await request<TenantUser[]>('/api/tenant/users')
      setUsers(nextUsers)
    } else {
      setUsers([])
    }
  }, [isAdmin])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        setError('')
        await refresh()
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load settings.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refresh])

  async function updateBranding(payload: {
    displayName: string
    logoUrl: string
    primaryColor: string
    accentColor: string
  }) {
    const updated = await request<TenantBranding>('/api/branding', {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
    setBranding(updated)
    applyBranding(updated)
    return updated
  }

  async function createParent(username: string, password: string) {
    const created = await request<TenantUser>('/api/tenant/parents', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    setUsers((prev) => [...prev, created].sort((a, b) => a.username.localeCompare(b.username)))
    return created
  }

  async function createCoach(payload: {
    academyName: string
    adminUsername: string
    adminPassword: string
    parentUsername?: string
    parentPassword?: string
    primaryColor: string
    accentColor: string
  }) {
    return request<{
      tenant: TenantBranding
      coach: { id: string; username: string; role: string }
      parent: { id: string; username: string; role: string } | null
    }>('/api/tenant/coaches', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async function deleteParent(id: string) {
    await request<void>(`/api/tenant/users/${id}`, { method: 'DELETE' })
    setUsers((prev) => prev.filter((u) => u.id !== id))
  }

  return {
    branding,
    users,
    loading,
    error,
    refresh,
    updateBranding,
    createParent,
    createCoach,
    deleteParent,
  }
}
