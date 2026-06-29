import type { Unit } from './units'

export type ShapeId = 'rect' | 'l' | 't' | 'u' | 'cut' | 'beveled'

/** Floor-plane point in centimeters. x = right, z = depth (forward). */
export interface Vec2 {
  x: number
  z: number
}

export type OpeningKind = 'door' | 'window'
export type DoorStyle = 'single' | 'glass' | 'french' | 'double' | 'bifold' | 'glassDouble'
export type WindowStyle = 'windowSingle' | 'windowDouble'
export type OpeningStyle = DoorStyle | WindowStyle

export interface Opening {
  id: string
  kind: OpeningKind
  style: OpeningStyle
  wallId: string
  /** center position along the wall, 0..1 */
  t: number
  width: number // cm
  height: number // cm
  sill: number // cm — bottom height above floor (0 for doors)
}

export type FurnitureCategory =
  | 'sofa'
  | 'bed'
  | 'table'
  | 'chair'
  | 'storage'
  | 'decor'
  | 'misc'

export interface FurnitureItem {
  id: string
  archetype: string // key into catalog
  category: FurnitureCategory
  name: string
  x: number // center, cm
  z: number // center, cm
  rotation: number // radians around Y (0 = facing +z)
  w: number // width (local x), cm
  d: number // depth (local z), cm
  h: number // height, cm
  color: string
}

export interface Materials {
  wallColor: string
  floorTexture: string // key into floor texture catalog
}

export interface RoomDesign {
  id: string
  name: string
  unit: Unit
  shape: ShapeId
  corners: Vec2[] // ordered polygon (cm)
  wallHeight: number // cm
  wallThickness: number // cm
  openings: Opening[]
  materials: Materials
  furniture: FurnitureItem[]
  createdAt: number
  updatedAt: number
}

/** Derived (not stored) wall segment between two consecutive corners. */
export interface Wall {
  id: string
  index: number
  a: Vec2
  b: Vec2
  length: number // cm
  dirX: number // unit direction a->b
  dirZ: number
  nx: number // unit inward normal
  nz: number
  midX: number
  midZ: number
  angle: number // rotation about Y so a +z-facing plane aligns to the wall
}
