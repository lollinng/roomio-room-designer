import { create } from 'zustand'
import type {
  RoomDesign,
  ShapeId,
  Vec2,
  Wall,
  Opening,
  OpeningStyle,
  FurnitureItem,
} from './types'
import type { Unit } from './units'
import { presetCorners } from './geometry/presets'
import { deriveWalls, bbox, signedArea, safeInteriorPoint } from './geometry/walls'
import { OPENING_MAP } from './data/openings'
import { ARCHETYPE_MAP } from './data/archetypes'
import { DEFAULT_WALL_COLOR, DEFAULT_FLOOR } from './data/materials'

export type Stage = 'start' | 'step1' | 'step2' | 'step3' | 'step4' | 'furnish'

export const WIZARD_STEPS: Stage[] = ['step1', 'step2', 'step3', 'step4']

export function uid(prefix = 'id'): string {
  try {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
  } catch {
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
  }
}

export function newDesign(shape: ShapeId = 'rect'): RoomDesign {
  const now = Date.now()
  return {
    id: uid('room'),
    name: 'Untitled room',
    unit: 'ft',
    shape,
    corners: presetCorners(shape),
    wallHeight: 270,
    wallThickness: 12,
    openings: [],
    materials: { wallColor: DEFAULT_WALL_COLOR, floorTexture: DEFAULT_FLOOR },
    furniture: [],
    createdAt: now,
    updatedAt: now,
  }
}

interface DesignStore {
  stage: Stage
  design: RoomDesign
  walls: Wall[]
  selectedOpeningId: string | null
  selectedFurnitureId: string | null
  /** the door/window style armed for placement (Step 3) */
  placingStyle: OpeningStyle | null
  /** transient: id of furniture currently flagged as overlapping another */
  overlapIds: string[]

  // ---- navigation ----
  setStage: (s: Stage) => void
  next: () => void
  back: () => void

  // ---- step 1 / shape ----
  setShape: (id: ShapeId) => void

  // ---- step 2 / dimensions ----
  setUnit: (u: Unit) => void
  dragWallPerp: (wallId: string, deltaCm: number) => void
  setWallLength: (wallId: string, lengthCm: number) => void
  setWallHeight: (cm: number) => void

  // ---- step 3 / openings ----
  setPlacingStyle: (style: OpeningStyle | null) => void
  addOpening: (style: OpeningStyle, wallId: string, t: number) => void
  moveOpening: (id: string, wallId: string, t: number) => void
  removeOpening: (id: string) => void
  selectOpening: (id: string | null) => void

  // ---- step 4 / materials ----
  setWallColor: (hex: string) => void
  setFloor: (id: string) => void

  // ---- furnish ----
  addFurniture: (archetypeId: string, x: number, z: number) => string
  /** add an item at a guaranteed-interior point of the room */
  addFurnitureCentered: (archetypeId: string) => string
  updateFurniture: (id: string, patch: Partial<FurnitureItem>) => void
  removeFurniture: (id: string) => void
  selectFurniture: (id: string | null) => void
  setOverlaps: (ids: string[]) => void

  // ---- design meta / persistence ----
  setName: (name: string) => void
  loadDesign: (d: RoomDesign) => void
  resetDesign: (shape?: ShapeId) => void
}

function touch(d: RoomDesign): RoomDesign {
  return { ...d, updatedAt: Date.now() }
}

export const useStore = create<DesignStore>((set, get) => ({
  stage: 'start',
  design: newDesign('rect'),
  walls: deriveWalls(presetCorners('rect')),
  selectedOpeningId: null,
  selectedFurnitureId: null,
  placingStyle: null,
  overlapIds: [],

  setStage: (s) => set({ stage: s }),
  next: () => {
    const { stage } = get()
    const i = WIZARD_STEPS.indexOf(stage)
    if (i >= 0 && i < WIZARD_STEPS.length - 1) set({ stage: WIZARD_STEPS[i + 1] })
    else if (stage === 'step4') set({ stage: 'furnish' })
  },
  back: () => {
    const { stage } = get()
    const i = WIZARD_STEPS.indexOf(stage)
    if (i > 0) set({ stage: WIZARD_STEPS[i - 1] })
    else if (stage === 'furnish') set({ stage: 'step4' })
    else if (stage === 'step1') set({ stage: 'start' })
  },

  setShape: (id) => {
    const corners = presetCorners(id)
    const design = touch({
      ...get().design,
      shape: id,
      corners,
      openings: [], // openings invalidated by new wall topology
    })
    set({ design, walls: deriveWalls(corners), selectedOpeningId: null })
  },

  setUnit: (u) => set({ design: touch({ ...get().design, unit: u }) }),

  dragWallPerp: (wallId, deltaCm) => {
    const { design } = get()
    const walls = get().walls
    const wall = walls.find((w) => w.id === wallId)
    if (!wall) return
    const corners = design.corners.map((c) => ({ ...c }))
    const i = wall.index
    const j = (i + 1) % corners.length
    corners[i].x += wall.nx * deltaCm
    corners[i].z += wall.nz * deltaCm
    corners[j].x += wall.nx * deltaCm
    corners[j].z += wall.nz * deltaCm
    applyCorners(set, get, corners)
  },

  setWallLength: (wallId, lengthCm) => {
    const { design, walls } = get()
    const wall = walls.find((w) => w.id === wallId)
    if (!wall) return
    const target = Math.max(60, lengthCm) // min 60cm
    const delta = target - wall.length
    if (Math.abs(delta) < 0.5) return
    const corners = design.corners.map((c) => ({ ...c }))
    const n = corners.length
    const ux = wall.dirX
    const uz = wall.dirZ
    // Move corner Q (index i+1) and the contiguous downstream chain whose
    // connecting walls are perpendicular to u, by u*delta. Keeps rectilinear
    // shapes rectilinear (closing wall stays parallel to u).
    const start = (wall.index + 1) % n
    const moved = new Set<number>()
    let k = start
    for (let steps = 0; steps < n - 1; steps++) {
      moved.add(k)
      const nextIdx = (k + 1) % n
      // direction of wall leaving k
      const ax = corners[nextIdx].x - corners[k].x
      const az = corners[nextIdx].z - corners[k].z
      const len = Math.hypot(ax, az) || 1
      const dot = (ax / len) * ux + (az / len) * uz
      // stop once the leaving wall is parallel to u (it will absorb the change)
      if (Math.abs(dot) > 0.7) break
      k = nextIdx
    }
    for (const idx of moved) {
      corners[idx].x += ux * delta
      corners[idx].z += uz * delta
    }
    // validate: keep winding (no inversion) and reasonable size
    const next = signedArea(corners)
    const prev = signedArea(design.corners)
    if (Math.sign(next) !== Math.sign(prev) || Math.abs(next) < 1000) return
    applyCorners(set, get, corners)
  },

  setWallHeight: (cm) =>
    set({ design: touch({ ...get().design, wallHeight: Math.max(180, Math.min(400, cm)) }) }),

  setPlacingStyle: (style) => set({ placingStyle: style }),
  addOpening: (style, wallId, t) => {
    const def = OPENING_MAP[style]
    if (!def) return
    const op: Opening = {
      id: uid('op'),
      kind: def.kind,
      style,
      wallId,
      t: Math.min(0.95, Math.max(0.05, t)),
      width: def.width,
      height: def.height,
      sill: def.sill,
    }
    set({
      design: touch({ ...get().design, openings: [...get().design.openings, op] }),
      selectedOpeningId: op.id,
    })
  },
  moveOpening: (id, wallId, t) =>
    set({
      design: touch({
        ...get().design,
        openings: get().design.openings.map((o) =>
          o.id === id ? { ...o, wallId, t: Math.min(0.97, Math.max(0.03, t)) } : o,
        ),
      }),
    }),
  removeOpening: (id) =>
    set({
      design: touch({
        ...get().design,
        openings: get().design.openings.filter((o) => o.id !== id),
      }),
      selectedOpeningId: get().selectedOpeningId === id ? null : get().selectedOpeningId,
    }),
  selectOpening: (id) => set({ selectedOpeningId: id }),

  setWallColor: (hex) =>
    set({ design: touch({ ...get().design, materials: { ...get().design.materials, wallColor: hex } }) }),
  setFloor: (id) =>
    set({ design: touch({ ...get().design, materials: { ...get().design.materials, floorTexture: id } }) }),

  addFurniture: (archetypeId, x, z) => {
    const a = ARCHETYPE_MAP[archetypeId]
    if (!a) return ''
    const item: FurnitureItem = {
      id: uid('f'),
      archetype: a.id,
      category: a.category,
      name: a.name,
      x,
      z,
      rotation: 0,
      w: a.w,
      d: a.d,
      h: a.h,
      color: a.color,
    }
    set({
      design: touch({ ...get().design, furniture: [...get().design.furniture, item] }),
      selectedFurnitureId: item.id,
    })
    return item.id
  },
  addFurnitureCentered: (archetypeId) => {
    const p = safeInteriorPoint(get().design.corners)
    return get().addFurniture(archetypeId, p.x, p.z)
  },
  updateFurniture: (id, patch) =>
    set({
      design: touch({
        ...get().design,
        furniture: get().design.furniture.map((f) => (f.id === id ? { ...f, ...patch } : f)),
      }),
    }),
  removeFurniture: (id) =>
    set({
      design: touch({
        ...get().design,
        furniture: get().design.furniture.filter((f) => f.id !== id),
      }),
      selectedFurnitureId: get().selectedFurnitureId === id ? null : get().selectedFurnitureId,
    }),
  selectFurniture: (id) => set({ selectedFurnitureId: id }),
  setOverlaps: (ids) => set({ overlapIds: ids }),

  setName: (name) => set({ design: touch({ ...get().design, name }) }),
  loadDesign: (d) =>
    set({
      design: d,
      walls: deriveWalls(d.corners),
      stage: 'furnish',
      selectedOpeningId: null,
      selectedFurnitureId: null,
    }),
  resetDesign: (shape = 'rect') => {
    const d = newDesign(shape)
    set({
      design: d,
      walls: deriveWalls(d.corners),
      stage: 'step1',
      selectedOpeningId: null,
      selectedFurnitureId: null,
    })
  },
}))

function applyCorners(
  set: (partial: Partial<DesignStore>) => void,
  get: () => DesignStore,
  corners: Vec2[],
) {
  set({
    design: touch({ ...get().design, corners }),
    walls: deriveWalls(corners),
  })
}

// convenience selectors
export const useDesign = () => useStore((s) => s.design)
export const useWalls = () => useStore((s) => s.walls)
export { bbox }
