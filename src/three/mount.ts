import type { FurnitureItem } from '../types'
import { ARCHETYPE_MAP, mountOf } from '../data/archetypes'

// ───────────────────────────────────────────────────────────────────────────
// Vertical placement (stacking / wall-mounting).
//
// Floor items sit at y=0. Wall items (TV, mirror, floating shelf) and surface
// items (table lamp) are lifted: onto a piece of furniture beneath them when one
// is there (e.g. a TV resting on a media console, a lamp on a side table), else
// to a sensible wall height. Numbers come from interior-design standards
// (TV center ≈107cm, gallery/art center ≈145cm, floating shelf ≈130cm).
// ───────────────────────────────────────────────────────────────────────────

const TV_CENTER_CM = 107
const WALL_SHELF_BASE_CM = 130
const MAX_SUPPORT_CM = 95 // don't try to stack onto a wardrobe / tall shelf

/** Is world point (x,z) inside item's rotated footprint? (cm) */
function pointInFootprint(item: FurnitureItem, x: number, z: number): boolean {
  const dx = x - item.x
  const dz = z - item.z
  const c = Math.cos(item.rotation)
  const s = Math.sin(item.rotation)
  // inverse of the footprint mapping (see geometry/collision.ts):
  // local = R^T · delta
  const lx = dx * c - dz * s
  const lz = dx * s + dz * c
  return Math.abs(lx) <= item.w / 2 && Math.abs(lz) <= item.d / 2
}

/**
 * Top height (cm) of the tallest floor piece directly beneath (x,z) that could
 * act as a surface (a table/console/cabinet up to MAX_SUPPORT_CM). 0 if none.
 */
function supportHeightAt(furniture: FurnitureItem[], x: number, z: number, selfId: string): number {
  let top = 0
  for (const f of furniture) {
    if (f.id === selfId) continue
    if (mountOf(f.archetype) !== 'floor') continue
    if (f.h < 25 || f.h > MAX_SUPPORT_CM) continue // too low (rug) or too tall to stack on
    if (!pointInFootprint(f, x, z)) continue
    if (f.h > top) top = f.h
  }
  return top
}

/** True if a piece is resting on a surface beneath it (e.g. a TV on a console). */
export function restsOnSurface(item: FurnitureItem, furniture: FurnitureItem[]): boolean {
  return supportHeightAt(furniture, item.x, item.z, item.id) > 0
}

/**
 * Mounted pieces (wall/surface) currently resting on `host` — i.e. their center
 * sits within the host's footprint and the host is a stackable surface. Used to
 * carry a lamp/TV along when its table/console is moved or rotated.
 */
export function dependentsOf(host: FurnitureItem, furniture: FurnitureItem[]): FurnitureItem[] {
  if (mountOf(host.archetype) !== 'floor') return []
  if (host.h < 25 || host.h > MAX_SUPPORT_CM) return []
  return furniture.filter(
    (f) => f.id !== host.id && mountOf(f.archetype) !== 'floor' && pointInFootprint(host, f.x, f.z),
  )
}

/**
 * Floor-to-base elevation (cm) for an item, accounting for what sits beneath it.
 *  - floor   → 0
 *  - surface → rests on the piece below (lamp on a table); 0 if nothing there
 *  - wall    → rests on the piece below (TV on a console); else a wall height
 *              (TVs centered ~107cm, floating shelves ~130cm, mirrors lean from floor)
 */
export function elevationCm(item: FurnitureItem, furniture: FurnitureItem[]): number {
  const mount = mountOf(item.archetype)
  if (mount === 'floor') return 0

  const support = supportHeightAt(furniture, item.x, item.z, item.id)
  if (mount === 'surface') return support
  // wall:
  if (support > 0) return support // resting on a console / credenza
  const a = ARCHETYPE_MAP[item.archetype]
  if (a?.model === 'tv') return Math.max(40, TV_CENTER_CM - item.h / 2)
  if (item.archetype === 'storage-wall-shelf') return WALL_SHELF_BASE_CM
  return 0 // mirrors etc. lean against the wall from the floor
}
