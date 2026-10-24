import type { MatchResult } from '@shared/types'

export interface PlayerStats {
  matches: number
  wins: number
  kills: number
  deaths: number
  shots: number
  hits: number
  accuracy: number
  winRate: number
}

/**
 * Summarises the local player's history.  Matches the player by id, never by
 * display name (names are not unique inside a room).
 */
export function computePlayerStats(
  matches: MatchResult[],
  playerId: string
): PlayerStats {
  let wins = 0
  let kills = 0
  let deaths = 0
  let shots = 0
  let hits = 0
  let played = 0

  for (const match of matches) {
    const player = match.players.find((candidate) => candidate.id === playerId)
    if (!player) continue
    played += 1
    kills += player.kills
    deaths += player.deaths
    shots += player.shots
    hits += player.hits
    if (match.winner !== 'draw' && player.team === match.winner) wins += 1
  }

  return {
    matches: played,
    wins,
    kills,
    deaths,
    shots,
    hits,
    accuracy: shots > 0 ? hits / shots : 0,
    winRate: played > 0 ? wins / played : 0
  }
}
