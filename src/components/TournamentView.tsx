import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useToast } from './ToastProvider'
import { CATEGORY_OPTIONS } from '../types'
import type { Category, PairingResult, Student, Tournament } from '../types'

interface TournamentViewProps {
  students: Student[]
  tournaments: Tournament[]
  loading: boolean
  error: string
  readOnly?: boolean
  onCreate: (name: string) => Promise<Tournament>
  onDelete: (id: string) => Promise<unknown>
  onAddPlayer: (
    tournamentId: string,
    payload: { studentId?: string; name?: string; category: Category },
  ) => Promise<unknown>
  onRemovePlayer: (tournamentId: string, playerId: string) => Promise<unknown>
  onPair: (tournamentId: string, rounds?: number) => Promise<unknown>
  onSetResult: (
    tournamentId: string,
    pairingId: string,
    result: PairingResult,
  ) => Promise<unknown>
}

function categoryLabel(value: string) {
  return CATEGORY_OPTIONS.find((o) => o.value === value)?.label ?? value
}

function statusLabel(status: string) {
  if (status === 'setup') return 'Setup'
  if (status === 'in_progress') return 'In progress'
  return 'Completed'
}

function resultLabel(result: PairingResult | null | undefined) {
  if (result === '1-0') return '1-0 (White)'
  if (result === '0-1') return '0-1 (Black)'
  if (result === '1/2-1/2') return '½-½ Draw'
  if (result === 'bye') return 'Bye (1 pt)'
  return 'Pending'
}

export function TournamentView({
  students,
  tournaments,
  loading,
  error,
  readOnly = false,
  onCreate,
  onDelete,
  onAddPlayer,
  onRemovePlayer,
  onPair,
  onSetResult,
}: TournamentViewProps) {
  const { showToast } = useToast()
  const [name, setName] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [playerName, setPlayerName] = useState('')
  const [studentId, setStudentId] = useState('')
  const [playerCategory, setPlayerCategory] = useState<'' | Category>('')
  const [rounds, setRounds] = useState('5')
  const [roundFilter, setRoundFilter] = useState<number | 'all'>('all')

  const selected = useMemo(
    () => tournaments.find((t) => t.id === selectedId) ?? tournaments[0] ?? null,
    [tournaments, selectedId],
  )

  const availableStudents = useMemo(() => {
    if (!selected) return students
    const taken = new Set(selected.players.map((p) => p.studentId).filter(Boolean))
    return students.filter((s) => !taken.has(s.id))
  }, [students, selected])

  const currentPairings = useMemo(() => {
    if (!selected) return []
    if (roundFilter === 'all') {
      return selected.pairings.filter((p) => p.round === selected.currentRound)
    }
    return selected.pairings.filter((p) => p.round === roundFilter)
  }, [selected, roundFilter])

  const roundComplete =
    selected != null &&
    selected.currentRound > 0 &&
    selected.pairings
      .filter((p) => p.round === selected.currentRound)
      .every((p) => p.result)

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    try {
      const created = await onCreate(name.trim())
      setName('')
      setSelectedId(created.id)
      showToast('Tournament created', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not create tournament.', 'error')
    }
  }

  async function handleAddStudent() {
    if (!selected || !studentId) return
    if (!playerCategory) {
      showToast('Select a category for this player.', 'error')
      return
    }
    try {
      await onAddPlayer(selected.id, { studentId, category: playerCategory })
      setStudentId('')
      setPlayerCategory('')
      showToast('Player added', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not add player.', 'error')
    }
  }

  async function handleAddNamed() {
    if (!selected) return
    if (!playerCategory) {
      showToast('Select a category for this player.', 'error')
      return
    }
    try {
      await onAddPlayer(selected.id, {
        name: playerName.trim(),
        category: playerCategory,
      })
      setPlayerName('')
      setPlayerCategory('')
      showToast('Player added', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not add player.', 'error')
    }
  }

  async function handlePair() {
    if (!selected) return
    try {
      const nextRounds =
        selected.status === 'setup' ? Number(rounds) : undefined
      await onPair(selected.id, nextRounds)
      setRoundFilter('all')
      showToast('Swiss pairings generated', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not pair round.', 'error')
    }
  }

  if (loading) {
    return (
      <section className="panel">
        <p className="muted">Loading tournaments…</p>
      </section>
    )
  }

  if (error) {
    return (
      <section className="panel">
        <div className="banner-error">
          <p>{error}</p>
        </div>
      </section>
    )
  }

  return (
    <section className="panel">
      <header className="panel-header">
        <div>
          <h1>Tournament</h1>
          <p className="muted">
            {readOnly
              ? 'Standings and round pairings. Results are entered by the admin.'
              : 'Open tournament — everyone plays together. After the last round, top 3 are listed for U-10, U-15, and Open.'}
          </p>
        </div>
      </header>

      {!readOnly ? (
        <form className="form-card" onSubmit={handleCreate}>
          <h2>Create tournament</h2>
          <label>
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Weekend Swiss"
              required
            />
          </label>
          <div className="form-actions">
            <button type="submit" className="btn primary">
              Create tournament
            </button>
          </div>
        </form>
      ) : null}

      {tournaments.length > 0 ? (
        <div className="header-controls" style={{ marginBottom: '1rem' }}>
          <label className="date-label">
            Open tournament
            <select
              value={selected?.id ?? ''}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : (
        <p className="muted">
          {readOnly
            ? 'No tournaments yet. Pairings and standings will appear here once the admin starts one.'
            : 'No tournaments yet. Create one to add players.'}
        </p>
      )}

      {selected ? (
        <>
          <div className="stat-grid parent-stats">
            <article className="stat-card">
              <p className="stat-label">Players</p>
              <p className="stat-value">{selected.players.length}</p>
              <p className="stat-sub muted">Open field</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">Round</p>
              <p className="stat-value">
                {selected.currentRound}/{selected.rounds || '—'}
              </p>
              <p className="stat-sub muted">{statusLabel(selected.status)}</p>
            </article>
          </div>

          {selected.status === 'setup' && !readOnly ? (
            <div className="fees-layout">
              <div className="form-card">
                <h2>Add player</h2>
                <label>
                  From students
                  <select
                    value={studentId}
                    onChange={(e) => {
                      const id = e.target.value
                      setStudentId(id)
                      const student = students.find((s) => s.id === id)
                      if (student?.category) {
                        setPlayerCategory(student.category)
                      }
                    }}
                  >
                    <option value="">Select student</option>
                    {availableStudents.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} · {categoryLabel(s.category)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Or enter name
                  <input
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="Player name"
                  />
                </label>
                <label>
                  Category
                  <select
                    value={playerCategory}
                    onChange={(e) =>
                      setPlayerCategory(e.target.value as '' | Category)
                    }
                    required
                  >
                    <option value="" disabled>
                      Select category
                    </option>
                    {CATEGORY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="form-actions">
                  <button
                    type="button"
                    className="btn primary"
                    disabled={!studentId}
                    onClick={() => void handleAddStudent()}
                  >
                    Add student
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={!playerName.trim()}
                    onClick={() => void handleAddNamed()}
                  >
                    Add player
                  </button>
                </div>
              </div>

              <div className="form-card">
                <h2>Swiss pairings</h2>
                <label>
                  Number of rounds
                  <input
                    type="number"
                    min={1}
                    max={15}
                    value={rounds}
                    onChange={(e) => setRounds(e.target.value)}
                  />
                </label>
                <p className="muted compact">
                  Add all players first. Pairing uses the Swiss method: similar
                  scores play each other, no rematches, bye if odd numbers.
                </p>
                <div className="form-actions">
                  <button
                    type="button"
                    className="btn primary"
                    disabled={selected.players.length < 2}
                    onClick={() => void handlePair()}
                  >
                    Make round 1 pairings
                  </button>
                  <button
                    type="button"
                    className="btn small danger"
                    onClick={async () => {
                      if (!confirm(`Delete ${selected.name}?`)) return
                      try {
                        await onDelete(selected.id)
                        setSelectedId(null)
                        showToast('Tournament deleted', 'success')
                      } catch (err) {
                        showToast(
                          err instanceof Error ? err.message : 'Could not delete.',
                          'error',
                        )
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ) : !readOnly ? (
            <div className="form-actions" style={{ marginBottom: '1rem' }}>
              <button
                type="button"
                className="btn primary"
                disabled={
                  selected.status === 'completed' ||
                  !roundComplete ||
                  selected.currentRound >= selected.rounds
                }
                onClick={() => void handlePair()}
              >
                Pair next round
              </button>
            </div>
          ) : null}

          <div className="table-wrap" style={{ marginBottom: '1.25rem' }}>
            <table>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Category</th>
                  {selected.status === 'setup' && !readOnly ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {selected.players.length === 0 ? (
                  <tr>
                    <td className="empty-cell" colSpan={readOnly ? 2 : 3}>
                      {readOnly
                        ? 'No players listed yet.'
                        : 'No players yet. Add students or enter names.'}
                    </td>
                  </tr>
                ) : (
                  selected.players.map((p) => (
                    <tr key={p.id}>
                      <td className="name-cell">{p.name}</td>
                      <td>
                        <span className="pill">{categoryLabel(p.category)}</span>
                      </td>
                      {selected.status === 'setup' && !readOnly ? (
                        <td className="row-actions">
                          <button
                            type="button"
                            className="btn small danger"
                            onClick={() => void onRemovePlayer(selected.id, p.id)}
                          >
                            Remove
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {selected.pairings.length > 0 ? (
            <>
              <div className="header-controls" style={{ marginBottom: '0.75rem' }}>
                <h2 style={{ margin: 0 }}>Pairings</h2>
                <label className="date-label">
                  Round
                  <select
                    value={roundFilter === 'all' ? String(selected.currentRound) : String(roundFilter)}
                    onChange={(e) => setRoundFilter(Number(e.target.value))}
                  >
                    {Array.from({ length: selected.currentRound }, (_, i) => i + 1).map(
                      (n) => (
                        <option key={n} value={n}>
                          Round {n}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              </div>
              <div className="table-wrap" style={{ marginBottom: '1.25rem' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Board</th>
                      <th>White</th>
                      <th>Black</th>
                      <th>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentPairings.map((p) => (
                      <tr key={p.id}>
                        <td>{p.board}</td>
                        <td className="name-cell">{p.whiteName}</td>
                        <td className="name-cell">{p.blackName ?? 'BYE'}</td>
                        <td>
                          {p.result === 'bye' || readOnly ? (
                            <span className="pill">{resultLabel(p.result)}</span>
                          ) : (
                            <select
                              value={p.result ?? ''}
                              onChange={async (e) => {
                                const value = e.target.value as PairingResult
                                if (!value) return
                                try {
                                  await onSetResult(selected.id, p.id, value)
                                  showToast('Result saved', 'success')
                                } catch (err) {
                                  showToast(
                                    err instanceof Error
                                      ? err.message
                                      : 'Could not save result.',
                                    'error',
                                  )
                                }
                              }}
                            >
                              <option value="">Add result</option>
                              <option value="1-0">1-0 (White)</option>
                              <option value="0-1">0-1 (Black)</option>
                              <option value="1/2-1/2">½-½ Draw</option>
                            </select>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          {selected.standings.length > 0 && selected.currentRound > 0 ? (
            <>
              <h2>Standings</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Player</th>
                      <th>Category</th>
                      <th>Pts</th>
                      <th>W</th>
                      <th>D</th>
                      <th>L</th>
                      <th>Buchholz</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.standings.map((s, index) => (
                      <tr key={s.id}>
                        <td>{index + 1}</td>
                        <td className="name-cell">{s.name}</td>
                        <td>
                          <span className="pill">{categoryLabel(s.category)}</span>
                        </td>
                        <td>{s.points}</td>
                        <td>{s.wins}</td>
                        <td>{s.draws}</td>
                        <td>{s.losses}</td>
                        <td>{s.buchholz}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          {selected.status === 'completed' ? (
            <>
              <h2>Top 3 by category</h2>
              <div className="fees-layout">
                {CATEGORY_OPTIONS.map((option) => {
                  const winners = selected.categoryWinners?.[option.value] ?? []
                  return (
                    <div key={option.value} className="form-card">
                      <h2>{option.label}</h2>
                      {winners.length === 0 ? (
                        <p className="muted compact">No players in this category.</p>
                      ) : (
                        <ol className="class-date-list">
                          {winners.map((w, index) => (
                            <li key={w.id}>
                              <span className="name-cell">
                                {index + 1}. {w.name}
                              </span>
                              <strong>{w.points} pts</strong>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
