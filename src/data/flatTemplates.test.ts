import { describe, it, expect } from 'vitest'
import {
  DESIGN_DEFAULTS,
  FURNITURE_PLAN,
  defaultFurnitureFor,
  FLAT_1BHK,
  FLAT_2BHK,
  FLAT_3BHK,
  type FlatSpec,
} from './flatTemplates'
import { ARCHETYPE_MAP } from './archetypes'
import { FLOOR_MAP } from './materials'
import { ROOM_TYPES } from '../../multi-room/src/index'

const FLATS: Array<[string, FlatSpec]> = [
  ['1BHK', FLAT_1BHK],
  ['2BHK', FLAT_2BHK],
  ['3BHK', FLAT_3BHK],
]

describe('flat template design defaults — id integrity', () => {
  it('every per-type floor id is a real FLOOR_TEXTURES id', () => {
    for (const [type, dd] of Object.entries(DESIGN_DEFAULTS)) {
      expect(FLOOR_MAP[dd!.floor], `floor '${dd!.floor}' for ${type}`).toBeTruthy()
    }
  })

  it('every per-type wall color is a hex string', () => {
    for (const [type, dd] of Object.entries(DESIGN_DEFAULTS)) {
      expect(dd!.wall, `wall for ${type}`).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })

  it('every starter-furniture archetype id is a real catalog id', () => {
    for (const [type, plan] of Object.entries(FURNITURE_PLAN)) {
      for (const p of plan!) {
        expect(ARCHETYPE_MAP[p.a], `archetype '${p.a}' for ${type}`).toBeTruthy()
      }
    }
  })

  it('DESIGN_DEFAULTS + FURNITURE_PLAN only key real RoomTypes', () => {
    for (const t of Object.keys(DESIGN_DEFAULTS)) expect(ROOM_TYPES).toContain(t)
    for (const t of Object.keys(FURNITURE_PLAN)) expect(ROOM_TYPES).toContain(t)
  })
})

describe('flat template layouts — geometry', () => {
  for (const [name, spec] of FLATS) {
    it(`${name}: every room type is real + has a name and positive size`, () => {
      expect(spec.length).toBeGreaterThan(0)
      for (const r of spec) {
        expect(ROOM_TYPES, `${name} room '${r.name}' type`).toContain(r.type)
        expect(r.name.length).toBeGreaterThan(0)
        expect(r.w).toBeGreaterThan(0)
        expect(r.l).toBeGreaterThan(0)
      }
    })

    it(`${name}: rooms do not OVERLAP (axis-aligned rects from bbox-center + size)`, () => {
      const rects = spec.map((r) => ({
        name: r.name,
        x0: r.x - r.w / 2,
        x1: r.x + r.w / 2,
        z0: r.z - r.l / 2,
        z1: r.z + r.l / 2,
      }))
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i], b = rects[j]
          // overlap iff they intersect on BOTH axes with a real area (touching edges are OK)
          const EPS = 1
          const overlapX = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)
          const overlapZ = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0)
          const overlaps = overlapX > EPS && overlapZ > EPS
          expect(overlaps, `${name}: '${a.name}' overlaps '${b.name}'`).toBe(false)
        }
      }
    })

    it(`${name}: rooms TILE their bounding rectangle with no gaps (areas sum to the bbox area)`, () => {
      const minX = Math.min(...spec.map((r) => r.x - r.w / 2))
      const maxX = Math.max(...spec.map((r) => r.x + r.w / 2))
      const minZ = Math.min(...spec.map((r) => r.z - r.l / 2))
      const maxZ = Math.max(...spec.map((r) => r.z + r.l / 2))
      const bboxArea = (maxX - minX) * (maxZ - minZ)
      const sumArea = spec.reduce((s, r) => s + r.w * r.l, 0)
      // no overlaps (asserted above) + areas equal ⇒ a perfect gapless tiling
      expect(sumArea).toBeCloseTo(bboxArea, -2) // within ~1% at this scale
    })
  }
})

describe('defaultFurnitureFor', () => {
  const corners = [
    { x: 0, z: 0 },
    { x: 400, z: 0 },
    { x: 400, z: 300 },
    { x: 0, z: 300 },
  ]

  it('kitchen gets counter + sink + stove (reads as a kitchen)', () => {
    const ids = defaultFurnitureFor('kitchen', corners).map((f) => f.archetype)
    expect(ids).toContain('kitchen-counter')
    expect(ids).toContain('kitchen-sink')
    expect(ids).toContain('kitchen-stove')
  })

  it('bathroom gets a toilet (commode) + vanity + shower', () => {
    const ids = defaultFurnitureFor('bathroom', corners).map((f) => f.archetype)
    expect(ids).toContain('bath-toilet')
    expect(ids).toContain('bath-vanity')
    expect(ids).toContain('bath-shower')
  })

  it('places every seed inside the room bbox', () => {
    for (const t of ['living', 'bedroom', 'kitchen', 'bathroom', 'dining'] as const) {
      for (const f of defaultFurnitureFor(t, corners)) {
        expect(f.x).toBeGreaterThanOrEqual(0)
        expect(f.x).toBeLessThanOrEqual(400)
        expect(f.z).toBeGreaterThanOrEqual(0)
        expect(f.z).toBeLessThanOrEqual(300)
      }
    }
  })

  it('unknown/empty types return no furniture (never throws)', () => {
    expect(defaultFurnitureFor('hallway', corners)).toEqual([])
  })
})
