function pairKey(a, b) {
  return [a, b].sort().join('|')
}

function playedSet(pairings) {
  const set = new Set()
  for (const p of pairings) {
    if (p.whiteId && p.blackId) set.add(pairKey(p.whiteId, p.blackId))
  }
  return set
}

function assignColors(a, b, roundNumber) {
  if (a.whites !== b.whites) {
    return a.whites < b.whites ? { white: a, black: b } : { white: b, black: a }
  }
  if (roundNumber === 1) {
    return { white: a, black: b }
  }
  return a.colorPref >= b.colorPref
    ? { white: a, black: b }
    : { white: b, black: a }
}

function tryPair(unpaired, played) {
  if (unpaired.length === 0) return []
  const first = unpaired[0]
  for (let i = 1; i < unpaired.length; i++) {
    const opp = unpaired[i]
    if (played.has(pairKey(first.id, opp.id))) continue
    const rest = unpaired.filter((_, idx) => idx !== 0 && idx !== i)
    const next = tryPair(rest, played)
    if (next) return [[first, opp], ...next]
  }
  return null
}

export function makeSwissPairings(players, previousPairings, roundNumber) {
  const played = playedSet(previousPairings)
  const ranked = [...players].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if ((b.buchholz ?? 0) !== (a.buchholz ?? 0)) {
      return (b.buchholz ?? 0) - (a.buchholz ?? 0)
    }
    return a.name.localeCompare(b.name)
  })

  let bye = null
  const pool = [...ranked]
  if (pool.length % 2 === 1) {
    for (let i = pool.length - 1; i >= 0; i--) {
      if (!pool[i].hadBye) {
        bye = pool.splice(i, 1)[0]
        break
      }
    }
    if (!bye) bye = pool.pop()
  }

  let pairs = tryPair(pool, played)
  if (!pairs) {
    pairs = tryPair(pool, new Set())
  }
  if (!pairs) {
    throw new Error('Could not generate Swiss pairings for this round.')
  }

  const boards = pairs.map(([a, b], index) => {
    const colors = assignColors(a, b, roundNumber)
    return {
      board: index + 1,
      whiteId: colors.white.id,
      blackId: colors.black.id,
      result: null,
    }
  })

  if (bye) {
    boards.push({
      board: boards.length + 1,
      whiteId: bye.id,
      blackId: null,
      result: 'bye',
    })
  }

  return boards
}

export function computeStandings(players, pairings) {
  const stats = new Map(
    players.map((p) => [
      p.id,
      {
        ...p,
        points: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        whites: 0,
        blacks: 0,
        hadBye: false,
        opponents: [],
      },
    ]),
  )

  for (const game of pairings) {
    const white = stats.get(game.whiteId)
    if (!white) continue

    if (!game.blackId || game.result === 'bye') {
      white.points += 1
      white.hadBye = true
      continue
    }

    const black = stats.get(game.blackId)
    if (!black) continue

    white.whites += 1
    black.blacks += 1
    white.opponents.push(game.blackId)
    black.opponents.push(game.whiteId)

    if (game.result === '1-0') {
      white.points += 1
      white.wins += 1
      black.losses += 1
    } else if (game.result === '0-1') {
      black.points += 1
      black.wins += 1
      white.losses += 1
    } else if (game.result === '1/2-1/2') {
      white.points += 0.5
      black.points += 0.5
      white.draws += 1
      black.draws += 1
    }
  }

  for (const player of stats.values()) {
    player.buchholz = player.opponents.reduce((sum, id) => {
      return sum + (stats.get(id)?.points ?? 0)
    }, 0)
    player.colorPref = player.blacks - player.whites
  }

  return [...stats.values()].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.buchholz !== a.buchholz) return b.buchholz - a.buchholz
    if (b.wins !== a.wins) return b.wins - a.wins
    return a.name.localeCompare(b.name)
  })
}
