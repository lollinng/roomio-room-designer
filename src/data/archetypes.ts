import type { FurnitureCategory } from '../types'
import rawCatalog from './archetypes.catalog.json'

// Furniture archetypes are built from parametric primitives (see three/Furniture3D.tsx)
// — clean topology, one editable color per piece, resizable within clamped bounds.
// This realizes the §6 "in-house parametric" path with zero external assets.
//
// The corpus itself lives in archetypes.catalog.json so it is one-file-extensible
// (add an entry → it shows up in the catalog and the detection contract). Every
// entry carries REAL-WORLD min/max dimensions (cm) as resize guardrails.

export type ModelKind =
  | 'sofa'
  | 'sectional'
  | 'bed'
  | 'table'
  | 'roundTable'
  | 'chair'
  | 'officeChair'
  | 'cabinet'
  | 'openShelf'
  | 'rug'
  | 'lamp'
  | 'plant'
  | 'box'
  // extended kinds
  | 'tv'
  | 'desk'
  | 'ottoman'
  | 'stool'
  | 'bench'
  | 'mirror'
  // kitchen / bathroom fixtures
  | 'counter'
  | 'toilet'
  | 'shower'
  | 'vanity'
  | 'bathtub'
  | 'tubFreestanding'
  | 'jacuzzi'
  | 'island'
  | 'stove'
  | 'fridge'
  | 'rangeHood'

/**
 * How a piece occupies space vertically:
 *  - 'floor'   default — sits on the floor and takes part in footprint collision.
 *  - 'wall'    hangs on a wall (TV, mirror, floating shelf): rendered at a wall
 *              height (or resting on a console below it), and EXEMPT from
 *              footprint collision so it can sit above floor furniture.
 *  - 'surface' sits on top of another piece (table lamp): elevated onto the
 *              surface beneath it and exempt from footprint collision.
 */
export type Mount = 'floor' | 'wall' | 'surface'

export interface Archetype {
  id: string
  category: FurnitureCategory
  name: string
  icon: string
  model: ModelKind
  w: number // cm (local x)
  d: number // cm (local z)
  h: number // cm
  min: [number, number, number]
  max: [number, number, number]
  color: string
  lockH?: boolean // height not resizable (rugs)
  mount: Mount
}

interface RawArchetype {
  id: string
  category: string
  name: string
  icon: string
  model: string
  w: number
  d: number
  h: number
  min: [number, number, number]
  max: [number, number, number]
  color: string
  lockH?: boolean
  mount?: string
}

const MODEL_KINDS: ModelKind[] = [
  'sofa', 'sectional', 'bed', 'table', 'roundTable', 'chair', 'officeChair',
  'cabinet', 'openShelf', 'rug', 'lamp', 'plant', 'box',
  'tv', 'desk', 'ottoman', 'stool', 'bench', 'mirror',
  'counter', 'toilet', 'shower', 'vanity', 'bathtub', 'tubFreestanding',
  'jacuzzi', 'island', 'stove', 'fridge', 'rangeHood',
]
const CATEGORIES: FurnitureCategory[] = ['sofa', 'bed', 'table', 'chair', 'storage', 'kitchen', 'bathroom', 'decor', 'misc']
const MOUNTS: Mount[] = ['floor', 'wall', 'surface']

/** Validate + normalize a raw catalog entry into a typed Archetype (defensive). */
function normalize(r: RawArchetype): Archetype {
  const model = (MODEL_KINDS as string[]).includes(r.model) ? (r.model as ModelKind) : 'box'
  const category = (CATEGORIES as string[]).includes(r.category) ? (r.category as FurnitureCategory) : 'misc'
  // guarantee min <= default <= max on every axis
  const clampAxis = (def: number, lo: number, hi: number): [number, number, number] => {
    const mn = Math.min(lo, def)
    const mx = Math.max(hi, def)
    return [mn, def, mx]
  }
  const [minW, , maxW] = clampAxis(r.w, r.min[0], r.max[0])
  const [minD, , maxD] = clampAxis(r.d, r.min[1], r.max[1])
  const [minH, , maxH] = clampAxis(r.h, r.min[2], r.max[2])
  return {
    id: r.id,
    category,
    name: r.name,
    icon: r.icon,
    model,
    w: r.w,
    d: r.d,
    h: r.h,
    min: [minW, minD, minH],
    max: [maxW, maxD, maxH],
    color: r.color,
    ...(r.lockH ? { lockH: true } : {}),
    mount: (MOUNTS as string[]).includes(r.mount ?? '') ? (r.mount as Mount) : 'floor',
  }
}

export const ARCHETYPES: Archetype[] = (rawCatalog as RawArchetype[]).map(normalize)

export const ARCHETYPE_MAP: Record<string, Archetype> = Object.fromEntries(
  ARCHETYPES.map((a) => [a.id, a]),
)

/** Mount class for an archetype id ('floor' for unknown ids). */
export function mountOf(id: string): Mount {
  return ARCHETYPE_MAP[id]?.mount ?? 'floor'
}

/** True for pieces that hang on a wall or sit on a surface (exempt from footprint collision). */
export function isMounted(id: string): boolean {
  return mountOf(id) !== 'floor'
}

export const CATEGORY_ORDER: { id: FurnitureCategory; label: string }[] = [
  { id: 'sofa', label: 'Sofas' },
  { id: 'bed', label: 'Beds' },
  { id: 'table', label: 'Tables' },
  { id: 'chair', label: 'Chairs' },
  { id: 'storage', label: 'Storage' },
  { id: 'kitchen', label: 'Kitchen' },
  { id: 'bathroom', label: 'Bathroom' },
  { id: 'decor', label: 'Decor' },
  { id: 'misc', label: 'Other' },
]
