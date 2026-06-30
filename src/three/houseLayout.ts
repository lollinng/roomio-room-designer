/**
 * House layout (Agent E, multi-room "whole house" view).
 *
 * Pure: given the session's rooms (Agent A RoomDesigns), arrange them into a
 * connected floor plan — placed ADJACENTLY in a row, sharing a wall, with a
 * DOORWAY cut between each consecutive pair so the rooms are interconnected
 * (not sealed boxes sitting next to each other).
 *
 * Coordinates are in DESIGN centimeters; `centerCm` is each room's bbox-center
 * position in the shared house plane (HouseView renders the room in a <group>
 * at centerCm/100 m, and makeFrame() centers the room on its bbox there).
 *
 * No coupling to Agent C's House model — this reuses only A's pure geometry
 * (bbox / deriveWalls). C's connector API formalizes the same idea; this is the
 * lightweight in-app layout for the overview.
 */
import { bbox, deriveWalls } from '../geometry/walls'
import type { Opening, RoomDesign, Wall } from '../types'

export interface PlacedRoom {
  design: RoomDesign
  /** bbox-center position in the house plane (world cm). */
  centerCm: { x: number; z: number }
  /** doorway openings to neighbours, added to the room's walls when rendering. */
  extraOpenings: Opening[]
}

const DOOR_WIDTH_CM = 90
const DOOR_HEIGHT_CM = 205
const ROOM_GAP_CM = 0 // touching, so the shared wall is exact

/** Pick the vertical wall on the given side (max/min midX), i.e. the +x / -x edge. */
function sideWall(walls: Wall[], side: 'left' | 'right'): Wall | undefined {
  const vertical = walls.filter((w) => Math.abs(w.dirX) < 0.25) // runs along z
  if (vertical.length === 0) return undefined
  return vertical.reduce((best, w) =>
    side === 'right' ? (w.midX > best.midX ? w : best) : (w.midX < best.midX ? w : best),
  )
}

function doorway(wallId: string, key: string): Opening {
  return {
    id: `connect_${key}`,
    kind: 'door',
    style: 'single',
    wallId,
    t: 0.5, // wall centre — rooms are z-aligned, so doorways meet
    width: DOOR_WIDTH_CM,
    height: DOOR_HEIGHT_CM,
    sill: 0,
  }
}

/**
 * Arrange rooms left-to-right, z-centred, each touching the previous along a
 * vertical shared wall, with a doorway cut in both rooms at that wall.
 */
export function layoutHouse(designs: RoomDesign[]): PlacedRoom[] {
  const placed: PlacedRoom[] = []
  let leftEdge = 0 // world cm: left edge of the next room

  for (const design of designs) {
    const bb = bbox(design.corners)
    const halfW = bb.w / 2
    const centerX = leftEdge + halfW
    placed.push({ design, centerCm: { x: centerX, z: 0 }, extraOpenings: [] })
    leftEdge = centerX + halfW + ROOM_GAP_CM
  }

  // doorway between each consecutive pair (shared vertical wall)
  for (let k = 1; k < placed.length; k++) {
    const a = placed[k - 1]
    const b = placed[k]
    const rightOfA = sideWall(deriveWalls(a.design.corners), 'right')
    const leftOfB = sideWall(deriveWalls(b.design.corners), 'left')
    if (rightOfA) a.extraOpenings.push(doorway(rightOfA.id, `${a.design.id}_R_${k}`))
    if (leftOfB) b.extraOpenings.push(doorway(leftOfB.id, `${b.design.id}_L_${k}`))
  }

  return placed
}

/** Whole-house bounding box (world cm) for camera framing. */
export function houseBoundsCm(placed: PlacedRoom[]): {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  w: number
  d: number
  cx: number
  cz: number
} {
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const p of placed) {
    const bb = bbox(p.design.corners)
    minX = Math.min(minX, p.centerCm.x - bb.w / 2)
    maxX = Math.max(maxX, p.centerCm.x + bb.w / 2)
    minZ = Math.min(minZ, p.centerCm.z - bb.d / 2)
    maxZ = Math.max(maxZ, p.centerCm.z + bb.d / 2)
  }
  if (!placed.length) {
    minX = maxX = minZ = maxZ = 0
  }
  return {
    minX,
    maxX,
    minZ,
    maxZ,
    w: maxX - minX,
    d: maxZ - minZ,
    cx: (minX + maxX) / 2,
    cz: (minZ + maxZ) / 2,
  }
}
