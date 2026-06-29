// Wall color swatches (matches the Step-4 reference palette) and floor textures.
// Floor textures are generated procedurally (see three/textures.ts) so the app
// has zero external asset dependencies.

export interface WallColor {
  id: string
  name: string
  hex: string
}

export const WALL_COLORS: WallColor[] = [
  { id: 'white', name: 'Pure white', hex: '#f4f1ea' },
  { id: 'sand', name: 'Warm sand', hex: '#d6c6a8' },
  { id: 'blush', name: 'Soft blush', hex: '#e8cdbf' },
  { id: 'terracotta', name: 'Terracotta', hex: '#b85c38' },
  { id: 'brick', name: 'Brick red', hex: '#7c3b34' },
  { id: 'sky', name: 'Pale sky', hex: '#bcd0d6' },
  { id: 'steel', name: 'Steel blue', hex: '#4f7488' },
  { id: 'sage', name: 'Sage green', hex: '#8fa07a' },
  { id: 'stone', name: 'Stone grey', hex: '#7c7b76' },
  { id: 'taupe', name: 'Taupe', hex: '#9a8167' },
  { id: 'plum', name: 'Dusty plum', hex: '#6f5168' },
  { id: 'pine', name: 'Pine green', hex: '#3f6b5b' },
]

export type FloorKind = 'wood' | 'tile' | 'concrete'

export interface FloorTexture {
  id: string
  name: string
  kind: FloorKind
  /** base color hex */
  base: string
  /** secondary tone for grain / grout */
  accent: string
  /** plank or tile size in cm */
  cell: number
}

export const FLOOR_TEXTURES: FloorTexture[] = [
  // --- Wood ---
  { id: 'natural-oak', name: 'Natural oak', kind: 'wood', base: '#c79a62', accent: '#a87f49', cell: 22 },
  { id: 'light-oak', name: 'Light oak', kind: 'wood', base: '#d9bd8c', accent: '#c2a06a', cell: 22 },
  { id: 'grey-wood', name: 'Grey wood', kind: 'wood', base: '#a39c92', accent: '#857e74', cell: 22 },
  { id: 'walnut', name: 'Walnut', kind: 'wood', base: '#7c5536', accent: '#5e3f27', cell: 22 },
  { id: 'cherry', name: 'Red cherry', kind: 'wood', base: '#a85636', accent: '#8a4026', cell: 22 },
  { id: 'espresso', name: 'Espresso', kind: 'wood', base: '#3f2f25', accent: '#2c2019', cell: 22 },
  { id: 'honey', name: 'Honey pine', kind: 'wood', base: '#cda05c', accent: '#b07f3c', cell: 18 },
  { id: 'ash', name: 'Pale ash', kind: 'wood', base: '#cabfa6', accent: '#b0a487', cell: 18 },
  { id: 'chevron', name: 'Smoked oak', kind: 'wood', base: '#9a7548', accent: '#7a5a33', cell: 20 },
  // --- Tile ---
  { id: 'white-tile', name: 'White tile', kind: 'tile', base: '#e8e6e1', accent: '#cfccc4', cell: 40 },
  { id: 'grey-tile', name: 'Grey tile', kind: 'tile', base: '#bdbcb8', accent: '#9d9c97', cell: 40 },
  { id: 'sand-tile', name: 'Sand tile', kind: 'tile', base: '#d8cdb8', accent: '#bcae93', cell: 40 },
  { id: 'slate-tile', name: 'Slate tile', kind: 'tile', base: '#6f7174', accent: '#54565a', cell: 40 },
  { id: 'marble-tile', name: 'Marble', kind: 'tile', base: '#ebe9e6', accent: '#cdd1d4', cell: 50 },
  { id: 'check-tile', name: 'Checker', kind: 'tile', base: '#e4e2dc', accent: '#3a3a3a', cell: 30 },
  // --- Concrete / soft ---
  { id: 'light-concrete', name: 'Light concrete', kind: 'concrete', base: '#cdcac4', accent: '#b6b3ac', cell: 100 },
  { id: 'mid-concrete', name: 'Concrete', kind: 'concrete', base: '#a8a6a1', accent: '#94928d', cell: 100 },
  { id: 'dark-concrete', name: 'Dark concrete', kind: 'concrete', base: '#6d6c69', accent: '#5a5956', cell: 100 },
]

export const FLOOR_MAP: Record<string, FloorTexture> = Object.fromEntries(
  FLOOR_TEXTURES.map((f) => [f.id, f]),
)

export const DEFAULT_WALL_COLOR = WALL_COLORS[0].hex
export const DEFAULT_FLOOR = 'natural-oak'
