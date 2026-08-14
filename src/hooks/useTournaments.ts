import { useCallback, useEffect, useState } from 'react'
import { request } from '../api'
import type { Category, PairingResult, Tournament } from '../types'

export function useTournaments() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    const data = await request<Tournament[]>('/api/tournaments')
    setTournaments(data)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        setError('')
        await refresh()
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Could not load tournaments.',
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refresh])

  async function createTournament(name: string) {
    const created = await request<Tournament>('/api/tournaments', {
      method: 'POST',
      body: JSON.stringify({ name }),
    })
    setTournaments((prev) => [created, ...prev])
    return created
  }

  async function deleteTournament(id: string) {
    await request<void>(`/api/tournaments/${id}`, { method: 'DELETE' })
    setTournaments((prev) => prev.filter((t) => t.id !== id))
  }

  async function addPlayer(
    tournamentId: string,
    payload: { studentId?: string; name?: string; category: Category },
  ) {
    const updated = await request<Tournament>(
      `/api/tournaments/${tournamentId}/players`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    )
    setTournaments((prev) => prev.map((t) => (t.id === tournamentId ? updated : t)))
    return updated
  }

  async function removePlayer(tournamentId: string, playerId: string) {
    const updated = await request<Tournament>(
      `/api/tournaments/${tournamentId}/players/${playerId}`,
      { method: 'DELETE' },
    )
    setTournaments((prev) => prev.map((t) => (t.id === tournamentId ? updated : t)))
    return updated
  }

  async function pairRound(tournamentId: string, rounds?: number) {
    const updated = await request<Tournament>(
      `/api/tournaments/${tournamentId}/pair`,
      {
        method: 'POST',
        body: JSON.stringify(rounds ? { rounds } : {}),
      },
    )
    setTournaments((prev) => prev.map((t) => (t.id === tournamentId ? updated : t)))
    return updated
  }

  async function setResult(
    tournamentId: string,
    pairingId: string,
    result: PairingResult,
  ) {
    const updated = await request<Tournament>(
      `/api/tournaments/${tournamentId}/pairings/${pairingId}`,
      {
        method: 'PUT',
        body: JSON.stringify({ result }),
      },
    )
    setTournaments((prev) => prev.map((t) => (t.id === tournamentId ? updated : t)))
    return updated
  }

  return {
    tournaments,
    loading,
    error,
    createTournament,
    deleteTournament,
    addPlayer,
    removePlayer,
    pairRound,
    setResult,
  }
}
