import type { Vec2 } from '../types'
import { bbox } from '../geometry/walls'

// World units are METERS. Room is centered on its bounding-box center.
export interface Frame {
  cx: number // cm
  cz: number // cm
  toWorld: (x: number, z: number) => [number, number]
}

export function makeFrame(corners: Vec2[]): Frame {
  const b = bbox(corners)
  return {
    cx: b.cx,
    cz: b.cz,
    toWorld: (x: number, z: number) => [(x - b.cx) / 100, (z - b.cz) / 100],
  }
}
