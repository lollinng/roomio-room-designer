/**
 * House session (Agent C, multi-room) — makes the /multi-room "add rooms" feature
 * usable in the real app. ADDITIVE: it sits on top of Agent A's single-`design`
 * store without modifying it. The editor (`useStore`) always edits ONE room (the
 * active room); this store owns the LIST of rooms and swaps which design is loaded
 * via A's public `loadDesign`, snapshotting the active room first.
 *
 * Reuses /multi-room's room-type taxonomy (bedroom/living/kitchen/bath/…). Each
 * room is a full RoomDesign, so the existing wizard steps (shape/dimensions/
 * openings/style) edit whichever room is active.
 */
import { create } from 'zustand'
import { useStore, newDesign } from '../store'
import type { RoomDesign, ShapeId, Vec2 } from '../types'
import { presetCorners } from '../geometry/presets'
import { bbox } from '../geometry/walls'
import { defaultOpenings } from '../data/defaultOpenings'
import { ROOM_TYPE_INFO, ROOM_TYPE_LIST, type RoomType } from '../../multi-room/src/index'

/**
 * Per-type starter furniture so each room reads as its function the moment it's
 * created (kitchens get a counter, bathrooms a shower + toilet, etc.) instead of
 * every new room being an identical empty box. Positions are in design cm,
 * placed against/near walls; addFurniture() snaps them flush via the §7 solver.
 * Unknown ids are no-ops, so this never throws.
 */
function defaultFurnitureFor(type: RoomType, corners: Vec2[]): Array<{ archetype: string; x: number; z: number }> {
  const b = bbox(corners)
  const cx = (b.minX + b.maxX) / 2
  const cz = (b.minZ + b.maxZ) / 2
  switch (type) {
    case 'kitchen':
      return [{ archetype: 'kitchen-counter', x: cx, z: b.minZ + 42 }]
    case 'bathroom':
      return [
        { archetype: 'bath-toilet', x: b.minX + 110, z: b.minZ + 48 },
        { archetype: 'bath-shower', x: b.maxX - 95, z: b.minZ + 95 },
      ]
    case 'living':
      return [
        { archetype: 'sofa-3', x: cx, z: b.maxZ - 75 },
        { archetype: 'table-coffee', x: cx, z: cz },
      ]
    case 'bedroom':
      return [{ archetype: 'bed-queen', x: cx, z: b.minZ + 120 }]
    case 'dining':
      return [{ archetype: 'table-dining', x: cx, z: cz }]
    default:
      return []
  }
}

export interface RoomEntry {
  /** equals the RoomDesign.id of this room */
  id: string
  type: RoomType
  /** snapshot of the room's design (the ACTIVE room's live copy lives in useStore) */
  design: RoomDesign
}

interface HouseSession {
  rooms: RoomEntry[]
  /** id of the room currently loaded in the editor (=== useStore.design.id). */
  activeId: string | null

  /** Seed the house from the current single design if it hasn't been initialized. */
  ensureInit: () => void
  /** Capture the editor's live design back into the active room entry. */
  syncActive: () => void
  /** Add a new room of `type` (+ optional shape) and switch to it. Returns its id. */
  addRoom: (type: RoomType, shape?: ShapeId) => string
  /** Load another room into the editor (snapshots the current one first). */
  switchRoom: (id: string) => void
  /** Change a room's functional type (drives naming + suggestion hints). */
  setRoomType: (id: string, type: RoomType) => void
  /** Remove a room (never the last); switches away if it was active. */
  removeRoom: (id: string) => void
}

/** Agent A's RoomDesign.roomType subset (suggestion engine). null if not applicable. */
function toDesignRoomType(type: RoomType): RoomDesign['roomType'] | undefined {
  switch (type) {
    case 'bedroom':
      return 'bedroom'
    case 'living':
      return 'living'
    case 'office':
      return 'office'
    default:
      return undefined // kitchen/bath/dining/foyer/hallway: A's engine defaults gracefully
  }
}

function inferType(d: RoomDesign): RoomType {
  const rt = d.roomType
  if (rt === 'bedroom' || rt === 'living' || rt === 'office') return rt
  return 'bedroom'
}

/** A unique, friendly name for a new room ("Kitchen", "Bedroom 2", …). */
function nameForType(type: RoomType, existing: RoomEntry[]): string {
  const base = ROOM_TYPE_INFO[type].label
  const sameType = existing.filter((r) => r.type === type).length
  return sameType === 0 ? base : `${base} ${sameType + 1}`
}

export const useHouse = create<HouseSession>((set, get) => ({
  rooms: [],
  activeId: null,

  ensureInit: () => {
    if (get().rooms.length > 0) return
    const d = useStore.getState().design
    set({ rooms: [{ id: d.id, type: inferType(d), design: d }], activeId: d.id })
  },

  syncActive: () => {
    const { activeId, rooms } = get()
    if (!activeId) return
    const live = useStore.getState().design
    set({ rooms: rooms.map((r) => (r.id === activeId ? { ...r, design: live } : r)) })
  },

  addRoom: (type, shape = 'rect') => {
    get().ensureInit()
    get().syncActive()
    const corners = presetCorners(shape)
    const d: RoomDesign = {
      ...newDesign(shape),
      name: nameForType(type, get().rooms),
      roomType: toDesignRoomType(type),
      corners,
      // a freshly added room also gets a default door + window(s), not a sealed box
      openings: defaultOpenings(corners),
    }
    set((s) => ({ rooms: [...s.rooms, { id: d.id, type, design: d }], activeId: d.id }))
    useStore.getState().loadDesign(d) // loads into the editor (stage → furnish)
    // Furnish the new room with type-appropriate starter pieces, then snapshot
    // the result back into the room entry so each room type looks distinct.
    const fixtures = defaultFurnitureFor(type, corners)
    for (const fx of fixtures) useStore.getState().addFurniture(fx.archetype, fx.x, fx.z)
    useStore.getState().selectFurniture(null)
    get().syncActive()
    return d.id
  },

  switchRoom: (id) => {
    const { activeId, rooms } = get()
    if (id === activeId) return
    get().syncActive()
    const entry = get().rooms.find((r) => r.id === id)
    if (!entry) return
    set({ activeId: id })
    useStore.getState().loadDesign(entry.design)
  },

  setRoomType: (id, type) =>
    set((s) => ({
      rooms: s.rooms.map((r) =>
        r.id === id ? { ...r, type, design: { ...r.design, roomType: toDesignRoomType(type) } } : r,
      ),
    })),

  removeRoom: (id) => {
    const { rooms, activeId } = get()
    if (rooms.length <= 1) return // keep at least one room
    get().syncActive()
    const remaining = get().rooms.filter((r) => r.id !== id)
    if (id === activeId) {
      const nextActive = remaining[0]
      set({ rooms: remaining, activeId: nextActive.id })
      useStore.getState().loadDesign(nextActive.design)
    } else {
      set({ rooms: remaining })
    }
  },
}))

export { ROOM_TYPE_LIST, ROOM_TYPE_INFO }
export type { RoomType }
