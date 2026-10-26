import { describe, expect, it } from 'vitest'
import type {
  AppearanceData,
  ClothingDescriptor,
  EnrollmentView,
  GalleryEntry
} from '@shared/types'
import {
  clothingSimilarity,
  computeTorsoCropRect,
  matchIdentity
} from './descriptors'

describe('computeTorsoCropRect', () => {
  it('builds a valid crop from a body box without pose keypoints', () => {
    const crop = computeTorsoCropRect(480, 720, [0.25, 0.1, 0.5, 0.8], null, null)
    expect(crop).not.toBeNull()
    if (!crop) return
    expect(crop.x).toBeGreaterThanOrEqual(0)
    expect(crop.y).toBeGreaterThanOrEqual(0)
    expect(crop.x + crop.width).toBeLessThanOrEqual(480)
    expect(crop.y + crop.height).toBeLessThanOrEqual(720)
    expect(crop.width).toBeGreaterThan(100)
    expect(crop.height).toBeGreaterThan(200)
  })

  it('uses normalized pose keypoints when they are available', () => {
    const crop = computeTorsoCropRect(
      480,
      720,
      [0.2, 0.1, 0.6, 0.8],
      { left: [0.35, 0.2], right: [0.65, 0.2] },
      { left: [0.38, 0.55], right: [0.62, 0.55] }
    )
    expect(crop).not.toBeNull()
    if (!crop) return
    expect(crop.y).toBeGreaterThan(100)
    expect(crop.y).toBeLessThan(180)
    expect(crop.width).toBeGreaterThan(150)
    expect(crop.width).toBeLessThan(220)
  })

  it('rejects a zero-sized source or a degenerate body box', () => {
    expect(computeTorsoCropRect(0, 720, [0.2, 0.2, 0.5, 0.5], null, null)).toBeNull()
    expect(
      computeTorsoCropRect(480, 720, [0.99, 0.99, 0.02, 0.02], null, null)
    ).toBeNull()
  })
})

function descriptor(hue: number, sat = 0.6, val = 0.6): ClothingDescriptor {
  const histogram = new Array(48).fill(0)
  histogram[0] = 0.5
  histogram[1] = 0.5
  const grid = new Array(27).fill(0)
  for (let cell = 0; cell < 9; cell += 1) {
    grid[cell * 3] = hue
    grid[cell * 3 + 1] = sat
    grid[cell * 3 + 2] = val
  }
  return {
    version: 1,
    view: 'front' as EnrollmentView,
    histogram,
    grid,
    aspect: 0.8,
    capturedAt: 0
  }
}

function appearance(clothing: ClothingDescriptor[]): AppearanceData {
  return {
    version: 1,
    faceEmbeddings: [],
    clothing,
    updatedAt: 0
  }
}

function entry(
  id: string,
  team: 'red' | 'blue' | null,
  clothing: ClothingDescriptor
): GalleryEntry {
  return { id, name: id, team, appearance: appearance([clothing]) }
}

describe('clothingSimilarity', () => {
  it('scores identical descriptors as 1', () => {
    const a = descriptor(0.1)
    expect(clothingSimilarity(a, a)).toBeCloseTo(1, 5)
  })

  it('scores different colours lower', () => {
    const a = descriptor(0.1)
    const b = descriptor(0.55)
    expect(clothingSimilarity(a, b)).toBeLessThan(1)
  })
})

describe('matchIdentity', () => {
  const noFace = (): number => 0

  it('matches the closest clothing descriptor', () => {
    const red = descriptor(0.1)
    const blue = descriptor(0.6)
    const gallery = [entry('red-player', 'red', red), entry('blue-player', 'blue', blue)]

    const match = matchIdentity(null, red, gallery, 'self', noFace)
    expect(match?.playerId).toBe('red-player')
    expect(match?.team).toBe('red')
    expect(match?.source).toBe('clothing')
  })

  it('returns null when two players look the same', () => {
    const same = descriptor(0.1)
    const gallery = [
      entry('player-a', 'red', same),
      entry('player-b', 'blue', same)
    ]

    expect(matchIdentity(null, same, gallery, 'self', noFace)).toBeNull()
  })

  it('never matches the local player', () => {
    const same = descriptor(0.1)
    const gallery = [entry('self', 'red', same)]
    expect(matchIdentity(null, same, gallery, 'self', noFace)).toBeNull()
  })

  it('ignores players without a team', () => {
    const same = descriptor(0.1)
    const gallery = [entry('neutral', null, same)]
    expect(matchIdentity(null, same, gallery, 'self', noFace)).toBeNull()
  })
})
