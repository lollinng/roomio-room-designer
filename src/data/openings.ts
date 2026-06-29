import type { OpeningKind, OpeningStyle } from '../types'

export interface OpeningDef {
  style: OpeningStyle
  kind: OpeningKind
  name: string
  width: number // cm
  height: number // cm
  sill: number // cm above floor
  leaves: number // number of door/sash leaves
  glass: number // 0..1 fraction of the leaf that is glazed
}

export const DOOR_DEFS: OpeningDef[] = [
  { style: 'single', kind: 'door', name: 'Single Panel Door', width: 85, height: 205, sill: 0, leaves: 1, glass: 0 },
  { style: 'glass', kind: 'door', name: 'Glass Door', width: 90, height: 205, sill: 0, leaves: 1, glass: 0.7 },
  { style: 'french', kind: 'door', name: 'French Double Door', width: 150, height: 210, sill: 0, leaves: 2, glass: 0.8 },
  { style: 'double', kind: 'door', name: 'Double Panel Door', width: 160, height: 205, sill: 0, leaves: 2, glass: 0 },
  { style: 'bifold', kind: 'door', name: 'Bifold Panel Double Door', width: 180, height: 205, sill: 0, leaves: 4, glass: 0 },
  { style: 'glassDouble', kind: 'door', name: 'Glass Double Door', width: 170, height: 210, sill: 0, leaves: 2, glass: 0.85 },
]

export const WINDOW_DEFS: OpeningDef[] = [
  { style: 'windowSingle', kind: 'window', name: 'Glass Window Single', width: 95, height: 120, sill: 95, leaves: 1, glass: 0.9 },
  { style: 'windowDouble', kind: 'window', name: 'Glass Window Double', width: 175, height: 130, sill: 90, leaves: 2, glass: 0.9 },
]

export const OPENING_DEFS: OpeningDef[] = [...DOOR_DEFS, ...WINDOW_DEFS]

export const OPENING_MAP: Record<string, OpeningDef> = Object.fromEntries(
  OPENING_DEFS.map((d) => [d.style, d]),
)
