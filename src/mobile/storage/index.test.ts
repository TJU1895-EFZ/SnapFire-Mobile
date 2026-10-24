import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_APP_SETTINGS, type MatchResult } from '@shared/types'
import { storage } from './index'

const MATCH: MatchResult = {
  matchId: 'match-1',
  mode: 'urban',
  startedAt: 1,
  endedAt: 2,
  durationMin: 5,
  killLimit: 10,
  winner: 'red',
  score: { red: 10, blue: 4 },
  players: [
    {
      id: 'player-1',
      name: 'Tester',
      team: 'red',
      kills: 10,
      deaths: 2,
      shots: 20,
      hits: 10,
      accuracy: 0.5
    }
  ]
}

beforeEach(async () => {
  await storage.resetAll()
})

describe('IndexedDbStorage', () => {
  it('creates and persists a profile', async () => {
    const profile = await storage.loadProfile()
    expect(profile.id.length).toBeGreaterThanOrEqual(8)

    profile.name = 'Tester'
    await storage.saveProfile(profile)

    const reloaded = await storage.loadProfile()
    expect(reloaded.id).toBe(profile.id)
    expect(reloaded.name).toBe('Tester')
  })

  it('merges stored settings with new defaults', async () => {
    await storage.saveSettings({ ...DEFAULT_APP_SETTINGS, volume: 0.25 })
    const loaded = await storage.loadSettings()
    expect(loaded.volume).toBe(0.25)
    expect(loaded.detectionQuality).toBe(DEFAULT_APP_SETTINGS.detectionQuality)
  })

  it('round-trips appearance data and clears it', async () => {
    await storage.saveAppearance({
      version: 1,
      faceEmbeddings: [[0.1, 0.2]],
      clothing: [],
      updatedAt: 1
    })
    const loaded = await storage.loadAppearance()
    expect(loaded?.faceEmbeddings).toEqual([[0.1, 0.2]])
    expect(loaded?.thumbnail).toBeUndefined()

    await storage.saveAppearance(null)
    expect(await storage.loadAppearance()).toBeNull()
  })

  it('stores history newest-first and caps it at 100 matches', async () => {
    const first = await storage.addHistory(MATCH)
    expect(first.matches).toHaveLength(1)

    for (let i = 0; i < 120; i += 1) {
      await storage.addHistory({ ...MATCH, matchId: `match-${i + 2}` })
    }

    const loaded = await storage.loadHistory()
    expect(loaded.matches).toHaveLength(100)
    expect(loaded.matches[0].matchId).toBe('match-121')
  })

  it('does not duplicate a re-delivered match result', async () => {
    await storage.addHistory(MATCH)
    await storage.addHistory({ ...MATCH, endedAt: 99 })
    const loaded = await storage.loadHistory()
    expect(loaded.matches).toHaveLength(1)
    expect(loaded.matches[0].endedAt).toBe(99)
  })

  it('resetAll clears all stores', async () => {
    await storage.saveAppearance({
      version: 1,
      faceEmbeddings: [],
      clothing: [],
      updatedAt: 1
    })
    await storage.addHistory(MATCH)
    await storage.resetAll()

    expect(await storage.loadAppearance()).toBeNull()
    expect((await storage.loadHistory()).matches).toHaveLength(0)
  })
})
