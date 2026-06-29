import type { FurnitureCategory } from '../types'

// Furniture archetypes are built from parametric primitives (see three/Furniture3D.tsx)
// — clean topology, one editable color per piece, resizable within clamped bounds.
// This realizes the §6 "in-house parametric" path with zero external assets.

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
}

// helper: clamp range as fractions of default
const span = (
  w: number,
  d: number,
  h: number,
  lo = 0.65,
  hi = 1.6,
): { min: [number, number, number]; max: [number, number, number] } => ({
  min: [Math.round(w * lo), Math.round(d * lo), Math.round(h * lo)],
  max: [Math.round(w * hi), Math.round(d * hi), Math.round(h * hi)],
})

export const ARCHETYPES: Archetype[] = [
  // ---- Sofa ----
  { id: 'sofa-3', category: 'sofa', name: '3-Seater Sofa', icon: '🛋️', model: 'sofa', w: 210, d: 92, h: 84, color: '#7d8a99', ...span(210, 92, 84) },
  { id: 'sofa-love', category: 'sofa', name: 'Loveseat', icon: '🛋️', model: 'sofa', w: 150, d: 90, h: 84, color: '#9c8f86', ...span(150, 90, 84) },
  { id: 'sofa-sectional', category: 'sofa', name: 'L-Shaped Sectional', icon: '🛋️', model: 'sectional', w: 260, d: 190, h: 84, color: '#6f7d72', ...span(260, 190, 84) },
  { id: 'sofa-recliner', category: 'sofa', name: 'Recliner', icon: '🛋️', model: 'sofa', w: 95, d: 98, h: 100, color: '#8a6f5e', ...span(95, 98, 100) },

  // ---- Bed ----
  { id: 'bed-single', category: 'bed', name: 'Single Bed', icon: '🛏️', model: 'bed', w: 100, d: 200, h: 95, color: '#cdbfa6', ...span(100, 200, 95) },
  { id: 'bed-queen', category: 'bed', name: 'Queen Bed', icon: '🛏️', model: 'bed', w: 160, d: 210, h: 100, color: '#c4b39a', ...span(160, 210, 100) },
  { id: 'bed-king', category: 'bed', name: 'King Bed', icon: '🛏️', model: 'bed', w: 200, d: 210, h: 105, color: '#b9a489', ...span(200, 210, 105) },

  // ---- Table ----
  { id: 'table-coffee', category: 'table', name: 'Coffee Table', icon: '🪵', model: 'table', w: 115, d: 60, h: 42, color: '#8a5a36', ...span(115, 60, 42, 0.6, 1.7) },
  { id: 'table-dining', category: 'table', name: 'Dining Table', icon: '🍽️', model: 'table', w: 160, d: 90, h: 75, color: '#7a5230', ...span(160, 90, 75) },
  { id: 'table-round', category: 'table', name: 'Round Dining Table', icon: '🍽️', model: 'roundTable', w: 120, d: 120, h: 75, color: '#7a5230', ...span(120, 120, 75) },
  { id: 'table-side', category: 'table', name: 'Side Table', icon: '🪵', model: 'table', w: 50, d: 50, h: 55, color: '#9a6a40', ...span(50, 50, 55) },

  // ---- Chair ----
  { id: 'chair-dining', category: 'chair', name: 'Dining Chair', icon: '🪑', model: 'chair', w: 46, d: 52, h: 90, color: '#6b6f76', ...span(46, 52, 90, 0.8, 1.25) },
  { id: 'chair-arm', category: 'chair', name: 'Armchair', icon: '🪑', model: 'sofa', w: 82, d: 84, h: 88, color: '#8f7d6b', ...span(82, 84, 88) },
  { id: 'chair-office', category: 'chair', name: 'Office Chair', icon: '🪑', model: 'officeChair', w: 62, d: 62, h: 110, color: '#3b3f45', ...span(62, 62, 110, 0.85, 1.2) },
  { id: 'chair-accent', category: 'chair', name: 'Accent Chair', icon: '🪑', model: 'sofa', w: 72, d: 76, h: 82, color: '#9a6a72', ...span(72, 76, 82) },

  // ---- Storage ----
  { id: 'storage-wardrobe', category: 'storage', name: 'Wardrobe', icon: '🚪', model: 'cabinet', w: 120, d: 60, h: 200, color: '#b39873', ...span(120, 60, 200, 0.7, 1.5) },
  { id: 'storage-bookcase', category: 'storage', name: 'Bookcase', icon: '📚', model: 'openShelf', w: 90, d: 32, h: 190, color: '#9a7a52', ...span(90, 32, 190, 0.7, 1.5) },
  { id: 'storage-tv', category: 'storage', name: 'TV Unit', icon: '📺', model: 'cabinet', w: 160, d: 42, h: 50, color: '#7a6a58', ...span(160, 42, 50) },
  { id: 'storage-dresser', category: 'storage', name: 'Dresser', icon: '🗄️', model: 'cabinet', w: 100, d: 50, h: 85, color: '#a98a63', ...span(100, 50, 85) },

  // ---- Decor ----
  { id: 'decor-rug', category: 'decor', name: 'Rug', icon: '🟫', model: 'rug', w: 200, d: 300, h: 1.5, color: '#c08a6a', ...span(200, 300, 1.5, 0.5, 1.8), lockH: true },
  { id: 'decor-lamp', category: 'decor', name: 'Floor Lamp', icon: '🛋', model: 'lamp', w: 40, d: 40, h: 160, color: '#cbb892', ...span(40, 40, 160, 0.8, 1.2) },
  { id: 'decor-plant', category: 'decor', name: 'Potted Plant', icon: '🪴', model: 'plant', w: 55, d: 55, h: 130, color: '#3f7a4b', ...span(55, 55, 130) },

  // ---- Fallback ----
  { id: 'misc-box', category: 'misc', name: 'Placeholder Box', icon: '📦', model: 'box', w: 60, d: 60, h: 60, color: '#b7b2a8', ...span(60, 60, 60, 0.3, 3) },
]

export const ARCHETYPE_MAP: Record<string, Archetype> = Object.fromEntries(
  ARCHETYPES.map((a) => [a.id, a]),
)

export const CATEGORY_ORDER: { id: FurnitureCategory; label: string }[] = [
  { id: 'sofa', label: 'Sofas' },
  { id: 'bed', label: 'Beds' },
  { id: 'table', label: 'Tables' },
  { id: 'chair', label: 'Chairs' },
  { id: 'storage', label: 'Storage' },
  { id: 'decor', label: 'Decor' },
  { id: 'misc', label: 'Other' },
]
