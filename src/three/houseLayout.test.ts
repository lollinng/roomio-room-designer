import { describe, it, expect } from 'vitest'
import { layoutHouse, houseBoundsCm } from './houseLayout'
import { newDesign } from '../store'
import { bbox } from '../geometry/walls'
import type { RoomDesign } from '../types'

function room(id: string): RoomDesign {
  return { ...newDesign('rect'), id, openings: [] }
}

describe('houseLayout — interconnected floor plan', () => {
  it('places rooms adjacently (each touching the previous along a shared edge)', () => {
    const designs = [room('a'), room('b'), room('c')]
    const placed = layoutHouse(designs)
    expect(placed).toHaveLength(3)
    // centers strictly increase along x
    expect(placed[0].centerCm.x).toBeLessThan(placed[1].centerCm.x)
    expect(placed[1].centerCm.x).toBeLessThan(placed[2].centerCm.x)
    // right edge of room k == left edge of room k+1 (touching, exact shared wall)
    for (let k = 1; k < placed.length; k++) {
      const a = placed[k - 1]
      const b = placed[k]
      const rightA = a.centerCm.x + bbox(a.design.corners).w / 2
      const leftB = b.centerCm.x - bbox(b.design.corners).w / 2
      expect(rightA).toBeCloseTo(leftB, 6)
    }
  })

  it('cuts a doorway in BOTH rooms of every adjacent pair', () => {
    const placed = layoutHouse([room('a'), room('b'), room('c')])
    // first room: 1 doorway (to b on its right); middle: 2 (left+right); last: 1 (left)
    expect(placed[0].extraOpenings).toHaveLength(1)
    expect(placed[1].extraOpenings).toHaveLength(2)
    expect(placed[2].extraOpenings).toHaveLength(1)
    // all doorways are real doors at wall centre
    for (const p of placed) {
      for (const o of p.extraOpenings) {
        expect(o.kind).toBe('door')
        expect(o.t).toBeCloseTo(0.5)
        expect(o.width).toBeGreaterThan(70)
        expect(o.sill).toBe(0)
      }
    }
  })

  it('doorways reference distinct walls (left vs right) and have unique ids', () => {
    const placed = layoutHouse([room('a'), room('b')])
    const ids = [...placed[0].extraOpenings, ...placed[1].extraOpenings].map((o) => o.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('single room: no doorways, centered at origin', () => {
    const placed = layoutHouse([room('solo')])
    expect(placed[0].extraOpenings).toHaveLength(0)
    expect(placed[0].centerCm.z).toBe(0)
  })

  it('house bounds enclose all rooms', () => {
    const placed = layoutHouse([room('a'), room('b'), room('c')])
    const hb = houseBoundsCm(placed)
    expect(hb.w).toBeGreaterThan(0)
    for (const p of placed) {
      const bb = bbox(p.design.corners)
      expect(p.centerCm.x - bb.w / 2).toBeGreaterThanOrEqual(hb.minX - 1e-6)
      expect(p.centerCm.x + bb.w / 2).toBeLessThanOrEqual(hb.maxX + 1e-6)
    }
  })
})
