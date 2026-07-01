// Flat templates + per-room-type design defaults (PURE data + geometry — no store/React/three, so
// it's unit-testable and a single source of truth). Consumed by src/three/houseSession.ts.
//
// Research-grounded (Indian NBC-2016 minimums + typical builder plans + interior-flooring norms):
//  - WET rooms (kitchen/bath) use TILE, never wood; bathrooms get a distinctive BLUE tile.
//  - DRY rooms (living/bedroom/dining/office) use warm wood; foyer gets premium marble.
//  - Each room gets type-appropriate STARTER FURNITURE so it reads as its function on sight.
// Every floor id indexes src/data/materials.ts FLOOR_TEXTURES; every archetype id is a real id in
// src/data/archetypes.catalog.json (pinned by flatTemplates.test.ts).

import type { Vec2 } from '../types'
import type { RoomType } from '../../multi-room/src/index'
import { bbox } from '../geometry/walls'

/** Distinctive per-room-type floor (FLOOR_TEXTURES id) + wall (hex) so each room reads distinctly. */
export const DESIGN_DEFAULTS: Partial<Record<RoomType, { floor: string; wall: string }>> = {
  living: { floor: 'natural-oak', wall: '#d6c6a8' },
  bedroom: { floor: 'light-oak', wall: '#e8cdbf' },
  kitchen: { floor: 'sand-tile', wall: '#f4f1ea' },
  bathroom: { floor: 'blue-tile', wall: '#bcd0d6' },
  dining: { floor: 'walnut', wall: '#9a8167' },
  foyer: { floor: 'marble-tile', wall: '#f4f1ea' },
  hallway: { floor: 'sand-tile', wall: '#f4f1ea' },
  office: { floor: 'grey-wood', wall: '#d6c6a8' },
  balcony: { floor: 'terracotta-tile', wall: '#8fa07a' },
}

/** Wall/corner seed anchors (cm) inside a room bbox. addFurniture()'s §7 solver snaps flush +
 *  resolves collisions, so these just distribute pieces to the right regions. */
export type Anchor =
  | 'back' | 'front' | 'left' | 'right' | 'center'
  | 'back-left' | 'back-right' | 'front-left' | 'front-right'
  | 'near-back' | 'near-front' | 'near-left' | 'near-right'

export function anchorPos(b: ReturnType<typeof bbox>, a: Anchor, inset = 45): { x: number; z: number } {
  const nearX = b.minX + inset, farX = b.maxX - inset
  const nearZ = b.minZ + inset, farZ = b.maxZ - inset
  const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2
  switch (a) {
    case 'back': return { x: cx, z: nearZ }
    case 'front': return { x: cx, z: farZ }
    case 'left': return { x: nearX, z: cz }
    case 'right': return { x: farX, z: cz }
    case 'back-left': return { x: nearX, z: nearZ }
    case 'back-right': return { x: farX, z: nearZ }
    case 'front-left': return { x: nearX, z: farZ }
    case 'front-right': return { x: farX, z: farZ }
    case 'near-back': return { x: cx, z: cz - 65 }
    case 'near-front': return { x: cx, z: cz + 65 }
    case 'near-left': return { x: cx - 65, z: cz }
    case 'near-right': return { x: cx + 65, z: cz }
    default: return { x: cx, z: cz }
  }
}

/** Per-type starter furniture (real catalog ids). Ordered so floor pieces (rug) land first; wall/
 *  surface pieces (tv, hood, mirror, table lamp) auto-mount via mount.ts. */
export const FURNITURE_PLAN: Partial<Record<RoomType, Array<{ a: string; at: Anchor }>>> = {
  living: [
    { a: 'decor-rug-large', at: 'center' },
    { a: 'sofa-3', at: 'front' },
    { a: 'table-coffee', at: 'center' },
    { a: 'storage-tv', at: 'back' },
    { a: 'decor-tv', at: 'back' },
    { a: 'chair-accent', at: 'front-left' },
    { a: 'decor-lamp-arc', at: 'back-right' },
  ],
  bedroom: [
    { a: 'decor-rug', at: 'center' },
    { a: 'bed-queen', at: 'back' },
    { a: 'storage-nightstand', at: 'back-left' },
    { a: 'storage-nightstand', at: 'back-right' },
    { a: 'storage-wardrobe', at: 'right' },
    { a: 'decor-lamp-table', at: 'back-left' },
  ],
  kitchen: [
    { a: 'kitchen-counter', at: 'back-left' },
    { a: 'kitchen-sink', at: 'back' },
    { a: 'kitchen-stove', at: 'back-right' },
    { a: 'kitchen-hood', at: 'back-right' },
    { a: 'kitchen-fridge', at: 'right' },
  ],
  bathroom: [
    { a: 'bath-toilet', at: 'back-left' },
    { a: 'bath-vanity', at: 'back-right' },
    { a: 'decor-mirror', at: 'back-right' },
    { a: 'bath-shower', at: 'front-right' },
  ],
  dining: [
    { a: 'table-dining', at: 'center' },
    { a: 'chair-dining', at: 'near-back' },
    { a: 'chair-dining', at: 'near-front' },
    { a: 'chair-dining', at: 'near-left' },
    { a: 'chair-dining', at: 'near-right' },
    { a: 'storage-sideboard', at: 'back-left' },
    { a: 'decor-lamp', at: 'back-right' },
  ],
  foyer: [
    { a: 'table-console', at: 'back' },
    { a: 'decor-mirror', at: 'back' },
    { a: 'bench-entry', at: 'front' },
  ],
  office: [
    { a: 'desk-office', at: 'back' },
    { a: 'chair-office', at: 'center' },
    { a: 'storage-bookcase', at: 'left' },
    { a: 'decor-lamp-table', at: 'back' },
  ],
  balcony: [
    { a: 'chair-lounge', at: 'left' },
    { a: 'table-side', at: 'center' },
    { a: 'decor-plant', at: 'right' },
  ],
  // hallway: intentionally empty (a narrow circulation corridor)
}

/**
 * Type-appropriate starter furniture for a room, as {archetype, x, z} in design cm. addFurniture()
 * snaps each flush via the §7 solver. Unknown types → []. Never throws.
 */
export function defaultFurnitureFor(type: RoomType, corners: Vec2[]): Array<{ archetype: string; x: number; z: number }> {
  const plan = FURNITURE_PLAN[type]
  if (!plan) return []
  const b = bbox(corners)
  return plan.map((p) => {
    const pos = anchorPos(b, p.at)
    return { archetype: p.a, x: pos.x, z: pos.z }
  })
}

export type FlatSpec = Array<{ name: string; type: RoomType; w: number; l: number; x: number; z: number }>

/**
 * 1BHK (~460 sq ft carpet). Tiles a 660×720 cm rectangle: left column = Living over Bedroom; right
 * column = Kitchen / Foyer / Bathroom / Utility stacked on a shared plumbing wall.
 */
export const FLAT_1BHK: FlatSpec = [
  { name: 'Living Room', type: 'living', w: 380, l: 400, x: 190, z: 200 },
  { name: 'Bedroom', type: 'bedroom', w: 380, l: 320, x: 190, z: 560 },
  { name: 'Kitchen', type: 'kitchen', w: 280, l: 250, x: 520, z: 125 },
  { name: 'Foyer', type: 'foyer', w: 280, l: 150, x: 520, z: 325 },
  { name: 'Bathroom', type: 'bathroom', w: 280, l: 150, x: 520, z: 475 },
  { name: 'Utility Balcony', type: 'balcony', w: 280, l: 170, x: 520, z: 635 },
]

/**
 * 2BHK (~800 sq ft carpet). Tiles a 900×1120 cm rectangle: public front (Living | Kitchen+Dining |
 * Balcony), a full-width hallway spine, then two bedrooms each with an attached bath at the rear.
 */
export const FLAT_2BHK: FlatSpec = [
  { name: 'Living Room', type: 'living', w: 520, l: 460, x: 260, z: 230 },
  { name: 'Kitchen', type: 'kitchen', w: 260, l: 230, x: 650, z: 115 },
  { name: 'Dining', type: 'dining', w: 260, l: 230, x: 650, z: 345 },
  { name: 'Balcony', type: 'balcony', w: 120, l: 460, x: 840, z: 230 },
  { name: 'Hallway', type: 'hallway', w: 900, l: 120, x: 450, z: 520 },
  { name: 'Master Bedroom', type: 'bedroom', w: 450, l: 370, x: 225, z: 765 },
  { name: 'Bedroom 2', type: 'bedroom', w: 450, l: 370, x: 675, z: 765 },
  { name: 'Master Bath', type: 'bathroom', w: 450, l: 170, x: 225, z: 1035 },
  { name: 'Common Bath', type: 'bathroom', w: 450, l: 170, x: 675, z: 1035 },
]

/**
 * 3BHK (~1250 sq ft carpet). Tiles a 1080×1200 cm rectangle: public front (Living | Kitchen/Dining |
 * Foyer), a full-width hallway spine, then a private rear wing (3 bedrooms + 2 baths).
 */
export const FLAT_3BHK: FlatSpec = [
  { name: 'Living Room', type: 'living', w: 520, l: 460, x: 260, z: 230 },
  { name: 'Kitchen', type: 'kitchen', w: 280, l: 230, x: 660, z: 115 },
  { name: 'Dining', type: 'dining', w: 280, l: 230, x: 660, z: 345 },
  { name: 'Foyer', type: 'foyer', w: 280, l: 460, x: 940, z: 230 },
  { name: 'Hallway', type: 'hallway', w: 1080, l: 120, x: 540, z: 520 },
  { name: 'Master Bedroom', type: 'bedroom', w: 430, l: 420, x: 215, z: 790 },
  { name: 'Bedroom 2', type: 'bedroom', w: 330, l: 420, x: 595, z: 790 },
  { name: 'Bedroom 3', type: 'bedroom', w: 320, l: 620, x: 920, z: 890 },
  { name: 'Master Bath', type: 'bathroom', w: 430, l: 200, x: 215, z: 1100 },
  { name: 'Common Bath', type: 'bathroom', w: 330, l: 200, x: 595, z: 1100 },
]
