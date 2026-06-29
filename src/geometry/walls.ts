import type { Vec2, Wall, Opening } from '../types'

export function polygonCentroid(corners: Vec2[]): Vec2 {
  let x = 0
  let z = 0
  for (const c of corners) {
    x += c.x
    z += c.z
  }
  return { x: x / corners.length, z: z / corners.length }
}

export interface BBox {
  minX: number
  minZ: number
  maxX: number
  maxZ: number
  w: number
  d: number
  cx: number
  cz: number
}

export function bbox(corners: Vec2[]): BBox {
  let minX = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxZ = -Infinity
  for (const c of corners) {
    if (c.x < minX) minX = c.x
    if (c.z < minZ) minZ = c.z
    if (c.x > maxX) maxX = c.x
    if (c.z > maxZ) maxZ = c.z
  }
  return {
    minX,
    minZ,
    maxX,
    maxZ,
    w: maxX - minX,
    d: maxZ - minZ,
    cx: (minX + maxX) / 2,
    cz: (minZ + maxZ) / 2,
  }
}

/** Signed area (shoelace). Positive => counter-clockwise in x/z. */
export function signedArea(corners: Vec2[]): number {
  let a = 0
  const n = corners.length
  for (let i = 0; i < n; i++) {
    const c = corners[i]
    const d = corners[(i + 1) % n]
    a += c.x * d.z - d.x * c.z
  }
  return a / 2
}

/**
 * Derive wall segments from an ordered corner polygon.
 * Inward normal is oriented toward the polygon centroid for robustness on
 * concave shapes (L/T/U).
 */
export function deriveWalls(corners: Vec2[]): Wall[] {
  const n = corners.length
  const c = polygonCentroid(corners)
  const walls: Wall[] = []
  for (let i = 0; i < n; i++) {
    const a = corners[i]
    const b = corners[(i + 1) % n]
    const dx = b.x - a.x
    const dz = b.z - a.z
    const length = Math.hypot(dx, dz)
    if (length < 1e-6) continue
    const dirX = dx / length
    const dirZ = dz / length
    // two normal candidates
    let nx = -dirZ
    let nz = dirX
    const midX = (a.x + b.x) / 2
    const midZ = (a.z + b.z) / 2
    // point inward (toward centroid)
    const towardCx = c.x - midX
    const towardCz = c.z - midZ
    if (nx * towardCx + nz * towardCz < 0) {
      nx = -nx
      nz = -nz
    }
    // angle so a plane whose normal is +z rotates to face inward normal
    const angle = Math.atan2(nx, nz)
    walls.push({
      id: `w${i}`,
      index: i,
      a,
      b,
      length,
      dirX,
      dirZ,
      nx,
      nz,
      midX,
      midZ,
      angle,
    })
  }
  return walls
}

/** Point on wall at parametric t (0..1) along a->b. */
export function pointOnWall(w: Wall, t: number): Vec2 {
  return {
    x: w.a.x + (w.b.x - w.a.x) * t,
    z: w.a.z + (w.b.z - w.a.z) * t,
  }
}

/** Is the polygon axis-aligned & rectilinear (all walls horizontal or vertical)? */
export function isRectilinear(walls: Wall[]): boolean {
  return walls.every(
    (w) => Math.abs(w.dirX) < 1e-3 || Math.abs(w.dirZ) < 1e-3,
  )
}

/**
 * A solid piece of a wall after openings are subtracted. Coordinates are along
 * the wall (u, from a→b, cm) and vertical (v, cm above floor).
 */
export interface WallPart {
  uCenter: number
  vCenter: number
  lenU: number
  lenV: number
}

/**
 * Decompose a wall into solid boxes, leaving rectangular holes for each opening.
 * Produces full-height strips between openings, plus a header above each opening
 * and a sill piece below windows. End strips are extended by half-thickness so
 * adjacent walls meet cleanly at corners.
 */
export function buildWallParts(
  wall: Wall,
  openings: Opening[],
  wallHeight: number,
  thickness: number,
): WallPart[] {
  const L = wall.length
  const ext = thickness / 2
  const parts: WallPart[] = []

  // opening intervals along u, clamped to the wall
  const ivs = openings
    .map((o) => {
      const u = o.t * L
      const half = o.width / 2
      return {
        uMin: Math.max(0, u - half),
        uMax: Math.min(L, u + half),
        vBottom: Math.max(0, o.sill),
        vTop: Math.min(wallHeight, o.sill + o.height),
      }
    })
    .filter((i) => i.uMax > i.uMin)
    .sort((a, b) => a.uMin - b.uMin)

  // merged covered u-intervals → gaps become full-height strips
  const merged: { uMin: number; uMax: number }[] = []
  for (const i of ivs) {
    const last = merged[merged.length - 1]
    if (last && i.uMin <= last.uMax + 0.1) last.uMax = Math.max(last.uMax, i.uMax)
    else merged.push({ uMin: i.uMin, uMax: i.uMax })
  }

  let cursor = 0
  const pushStrip = (a: number, b: number) => {
    if (b - a < 0.1) return
    const start = a <= 0.1 ? -ext : a
    const end = b >= L - 0.1 ? L + ext : b
    parts.push({ uCenter: (start + end) / 2, lenU: end - start, vCenter: wallHeight / 2, lenV: wallHeight })
  }
  for (const m of merged) {
    pushStrip(cursor, m.uMin)
    cursor = m.uMax
  }
  pushStrip(cursor, L)

  // header above + sill below each opening
  for (const i of ivs) {
    const w = i.uMax - i.uMin
    const uc = (i.uMin + i.uMax) / 2
    if (wallHeight - i.vTop > 0.1) {
      parts.push({ uCenter: uc, lenU: w, vCenter: (i.vTop + wallHeight) / 2, lenV: wallHeight - i.vTop })
    }
    if (i.vBottom > 0.1) {
      parts.push({ uCenter: uc, lenU: w, vCenter: i.vBottom / 2, lenV: i.vBottom })
    }
  }
  return parts
}

/** A guaranteed-interior point of the polygon (centroid, else grid-sampled). */
export function safeInteriorPoint(corners: Vec2[]): Vec2 {
  const c = polygonCentroid(corners)
  if (pointInPolygon(c, corners)) return c
  const b = bbox(corners)
  let best: Vec2 = c
  let bestScore = -Infinity
  for (let i = 1; i < 8; i++) {
    for (let j = 1; j < 8; j++) {
      const p = { x: b.minX + (b.w * i) / 8, z: b.minZ + (b.d * j) / 8 }
      if (pointInPolygon(p, corners)) {
        // prefer points near the bbox center
        const score = -Math.hypot(p.x - b.cx, p.z - b.cz)
        if (score > bestScore) {
          bestScore = score
          best = p
        }
      }
    }
  }
  return best
}

/** Point-in-polygon test (ray casting), point & corners in cm. */
export function pointInPolygon(pt: Vec2, corners: Vec2[]): boolean {
  let inside = false
  const n = corners.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const ci = corners[i]
    const cj = corners[j]
    const intersect =
      ci.z > pt.z !== cj.z > pt.z &&
      pt.x < ((cj.x - ci.x) * (pt.z - ci.z)) / (cj.z - ci.z) + ci.x
    if (intersect) inside = !inside
  }
  return inside
}
