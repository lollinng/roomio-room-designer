import type { RoomDesign } from './types'

/** localStorage key holding the JSON map { [id]: RoomDesign }. */
const STORAGE_KEY = 'roomio.designs.v1'

export interface DesignSummary {
  id: string
  name: string
  updatedAt: number
  createdAt: number
  shape: string
}

type DesignMap = Record<string, RoomDesign>

/** Read the whole design map from localStorage, tolerating any corruption. */
function readMap(): DesignMap {
  try {
    if (typeof localStorage === 'undefined') return {}
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: DesignMap = {}
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      const d = coerceDesign(value)
      if (d && d.id === id) out[id] = d
    }
    return out
  } catch {
    return {}
  }
}

/** Persist the design map back to localStorage, swallowing quota/availability errors. */
function writeMap(map: DesignMap): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // ignore: storage unavailable, full, or in private mode
  }
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function isVec2(v: unknown): v is { x: number; z: number } {
  return (
    !!v &&
    typeof v === 'object' &&
    isFiniteNumber((v as { x: unknown }).x) &&
    isFiniteNumber((v as { z: unknown }).z)
  )
}

/**
 * Validate and normalize an unknown value into a RoomDesign.
 * Returns null when required fields are missing or malformed. Optional arrays
 * (openings, furniture) are coerced to [] when absent or invalid.
 */
function coerceDesign(value: unknown): RoomDesign | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const v = value as Record<string, unknown>

  // ---- required scalars ----
  if (typeof v.id !== 'string' || !v.id) return null
  if (typeof v.shape !== 'string' || !v.shape) return null

  // ---- required corner polygon ----
  if (!Array.isArray(v.corners) || v.corners.length < 3) return null
  const corners = v.corners.map((c) => (isVec2(c) ? { x: c.x, z: c.z } : null))
  if (corners.some((c) => c === null)) return null

  // ---- required materials ----
  const rawMaterials = v.materials
  if (!rawMaterials || typeof rawMaterials !== 'object' || Array.isArray(rawMaterials)) return null
  const mat = rawMaterials as Record<string, unknown>
  if (typeof mat.wallColor !== 'string' || typeof mat.floorTexture !== 'string') return null

  // ---- defaults for optional / derivable scalars ----
  const name = typeof v.name === 'string' ? v.name : 'Untitled room'
  const unit = v.unit === 'cm' || v.unit === 'ft' ? v.unit : 'ft'
  const wallHeight = isFiniteNumber(v.wallHeight) ? v.wallHeight : 270
  const wallThickness = isFiniteNumber(v.wallThickness) ? v.wallThickness : 12
  const createdAt = isFiniteNumber(v.createdAt) ? v.createdAt : Date.now()
  const updatedAt = isFiniteNumber(v.updatedAt) ? v.updatedAt : createdAt

  // ---- optional arrays: coerce missing/invalid to [] ----
  const openings = Array.isArray(v.openings) ? (v.openings as RoomDesign['openings']) : []
  const furniture = Array.isArray(v.furniture) ? (v.furniture as RoomDesign['furniture']) : []

  return {
    id: v.id,
    name,
    unit,
    shape: v.shape as RoomDesign['shape'],
    corners: corners as RoomDesign['corners'],
    wallHeight,
    wallThickness,
    openings,
    materials: { wallColor: mat.wallColor, floorTexture: mat.floorTexture },
    furniture,
    createdAt,
    updatedAt,
  }
}

/** All saved designs as lightweight summaries, newest first by updatedAt. */
export function listDesigns(): DesignSummary[] {
  const map = readMap()
  return Object.values(map)
    .map((d) => ({
      id: d.id,
      name: d.name,
      updatedAt: d.updatedAt,
      createdAt: d.createdAt,
      shape: d.shape,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

/** Upsert a design by id, stamping updatedAt = now. */
export function saveDesign(d: RoomDesign): void {
  const map = readMap()
  map[d.id] = { ...d, updatedAt: Date.now() }
  writeMap(map)
}

/** Load a single design by id, or null if absent/corrupt. */
export function loadDesign(id: string): RoomDesign | null {
  const map = readMap()
  return map[id] ?? null
}

/** Remove a design by id (no-op if it does not exist). */
export function deleteDesign(id: string): void {
  const map = readMap()
  if (id in map) {
    delete map[id]
    writeMap(map)
  }
}

/** Serialize a design to a pretty JSON string. */
export function exportDesignJSON(d: RoomDesign): string {
  return JSON.stringify(d, null, 2)
}

/** Parse + validate a JSON string into a RoomDesign; null on any failure. */
export function importDesignJSON(json: string): RoomDesign | null {
  try {
    const parsed = JSON.parse(json) as unknown
    return coerceDesign(parsed)
  } catch {
    return null
  }
}

/** Trigger a browser download of the design as a `${name}.json` file. */
export function downloadDesign(d: RoomDesign): void {
  try {
    if (typeof document === 'undefined' || typeof URL === 'undefined') return
    const json = exportDesignJSON(d)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const safeName = (d.name || 'design').trim().replace(/[^\w.-]+/g, '_') || 'design'
    const a = document.createElement('a')
    a.href = url
    a.download = `${safeName}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch {
    // ignore: download not possible in this environment
  }
}
