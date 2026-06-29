import { describe, it, expect } from 'vitest'
import { ROOM_TYPES } from '../types'
import {
  ROOM_TYPE_INFO,
  essentialsFor,
  guidanceFor,
  missingAssetsFor,
  resolveEssentialArchetype,
  PLACEHOLDER_ARCHETYPE,
} from './roomTypes'
import { allAssetGaps, assetRequestSummary } from './assetRequests'
import catalog from '../../../src/data/archetypes.catalog.json'

// The set of real catalog ids Agent A owns (single source of truth).
const CATALOG_IDS = new Set(
  (Array.isArray(catalog) ? catalog : (catalog as { archetypes?: { id: string }[] }).archetypes ?? []).map(
    (a: { id: string }) => a.id,
  ),
)

describe('C2 — room typing + per-type essentials', () => {
  it('covers all 8 room types with purpose, essentials, guidance', () => {
    for (const t of ROOM_TYPES) {
      const info = ROOM_TYPE_INFO[t]
      expect(info.purpose.length).toBeGreaterThan(0)
      expect(info.essentials.length).toBeGreaterThan(0)
      expect(info.guidance.length).toBeGreaterThan(0)
    }
  })

  it('every non-null essential archetype is a REAL id in Agent A’s catalog', () => {
    expect(CATALOG_IDS.size).toBe(91)
    for (const t of ROOM_TYPES) {
      for (const e of essentialsFor(t)) {
        if (e.archetype !== null) {
          expect(CATALOG_IDS.has(e.archetype), `${t} essential "${e.label}" → ${e.archetype}`).toBe(true)
        }
      }
    }
  })

  it('un-modeled essentials resolve to the Placeholder Box (don’t block)', () => {
    const counters = ROOM_TYPE_INFO.kitchen.essentials.find((e) => e.label.startsWith('Counters'))!
    expect(counters.archetype).toBeNull()
    expect(resolveEssentialArchetype(counters)).toBe(PLACEHOLDER_ARCHETYPE)
    expect(CATALOG_IDS.has(PLACEHOLDER_ARCHETYPE)).toBe(true)
  })

  it('kitchen offers work-triangle + island guidance', () => {
    const g = guidanceFor('kitchen').join(' ')
    expect(g).toMatch(/work triangle/i)
    expect(g).toMatch(/island/i)
    expect(g).toMatch(/42 in|107 cm/i) // aisle / island clearance
  })

  it('bathroom offers clearance + privacy guidance', () => {
    const g = guidanceFor('bathroom').join(' ')
    expect(g).toMatch(/clearance/i)
    expect(g).toMatch(/privacy|pocket door|hinged/i)
  })

  it('surfaces the kitchen/bath asset gaps for REQUEST -> ASSET', () => {
    const gaps = allAssetGaps()
    const labels = gaps.map((g) => `${g.type}:${g.essential.label}`)
    expect(labels.some((l) => l.startsWith('kitchen:'))).toBe(true)
    expect(labels.some((l) => l.startsWith('bathroom:'))).toBe(true)
    expect(assetRequestSummary()).toMatch(/kitchen:.*Sink/)
    expect(missingAssetsFor('living')).toHaveLength(0) // living is fully modeled
  })
})
