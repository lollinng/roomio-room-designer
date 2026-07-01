import { describe, it, expect } from 'vitest'
import { useHouse } from './houseSession'
import { useStore } from '../store'
import { layoutHouse } from './houseLayout'
import { bbox } from '../geometry/walls'

describe('houseSession — delete room + undo', () => {
  it('removeRoom captures an undo snapshot; undoRemove restores it at its original index', () => {
    // start from a clean 3-room house
    useHouse.setState({ rooms: [], activeId: null, lastRemoved: null })
    const h = useHouse.getState()
    h.ensureInit() // seeds one room from the editor's current design
    const id1 = useHouse.getState().rooms[0].id
    const id2 = h.addRoom('kitchen')
    const id3 = h.addRoom('bedroom')
    expect(useHouse.getState().rooms.map((r) => r.id)).toEqual([id1, id2, id3])

    // delete the MIDDLE room — no confirm, instant
    useHouse.getState().removeRoom(id2)
    expect(useHouse.getState().rooms.map((r) => r.id)).toEqual([id1, id3])
    expect(useHouse.getState().lastRemoved?.entry.id).toBe(id2)
    expect(useHouse.getState().lastRemoved?.index).toBe(1)

    // UNDO restores it at index 1 and clears the snapshot
    useHouse.getState().undoRemove()
    expect(useHouse.getState().rooms.map((r) => r.id)).toEqual([id1, id2, id3])
    expect(useHouse.getState().lastRemoved).toBeNull()
  })

  it('keeps the last room (cannot delete it) and dismissUndo clears the snapshot', () => {
    useHouse.setState({ rooms: [], activeId: null, lastRemoved: null })
    const h = useHouse.getState()
    h.ensureInit()
    const only = useHouse.getState().rooms[0].id
    h.removeRoom(only)
    expect(useHouse.getState().rooms).toHaveLength(1) // never the last
    expect(useHouse.getState().lastRemoved).toBeNull()

    const id2 = h.addRoom('bathroom')
    useHouse.getState().removeRoom(id2)
    expect(useHouse.getState().lastRemoved?.entry.id).toBe(id2)
    useHouse.getState().dismissUndo()
    expect(useHouse.getState().lastRemoved).toBeNull()
  })
})

// The 3BHK must read as ONE connected house — not scattered/overlapping boxes.
describe('houseSession — 3BHK flat is one gap-free, connected floor plan', () => {
  function boxes() {
    useHouse.setState({ rooms: [], activeId: null, lastRemoved: null })
    useHouse.getState().loadFlat3BHK()
    return useHouse.getState().rooms.map((r) => {
      const bb = bbox(r.design.corners)
      return { id: r.id, name: r.design.name, minX: r.pos!.x - bb.w / 2, maxX: r.pos!.x + bb.w / 2, minZ: r.pos!.z - bb.d / 2, maxZ: r.pos!.z + bb.d / 2, w: bb.w, d: bb.d }
    })
  }

  it('loads 10 rooms that do not overlap', () => {
    const b = boxes()
    expect(b).toHaveLength(10)
    for (let i = 0; i < b.length; i++)
      for (let j = i + 1; j < b.length; j++) {
        const ix = Math.min(b[i].maxX, b[j].maxX) - Math.max(b[i].minX, b[j].minX)
        const iz = Math.min(b[i].maxZ, b[j].maxZ) - Math.max(b[i].minZ, b[j].minZ)
        expect(ix > 1 && iz > 1, `${b[i].name} overlaps ${b[j].name}`).toBe(false)
      }
  })

  it('tiles the house rectangle with NO gaps (room areas sum to the bounding area)', () => {
    const b = boxes()
    const minX = Math.min(...b.map((r) => r.minX)), maxX = Math.max(...b.map((r) => r.maxX))
    const minZ = Math.min(...b.map((r) => r.minZ)), maxZ = Math.max(...b.map((r) => r.maxZ))
    const sum = b.reduce((s, r) => s + r.w * r.d, 0)
    expect(sum).toBe((maxX - minX) * (maxZ - minZ)) // gap-free ⇒ union == bounding rect
  })

  it('layoutHouse cuts a doorway into every room — so the whole plan is reachable', () => {
    useHouse.setState({ rooms: [], activeId: null, lastRemoved: null })
    useHouse.getState().loadFlat3BHK()
    const rooms = useHouse.getState().rooms
    const placed = layoutHouse(rooms.map((r) => ({ design: r.design, pos: r.pos, type: r.type })))
    for (const p of placed)
      expect(p.extraOpenings.length, `${p.design.name} has no doorway`).toBeGreaterThan(0)
    // the hallway is the spine: it should connect to the most rooms
    const hall = placed.find((p) => p.design.name === 'Hallway')!
    expect(hall.extraOpenings.length).toBeGreaterThanOrEqual(5)
  })
})

// Clicking a room in the plan view must let you customize its size.
describe('houseSession — resizeRoom (plan-view room resize)', () => {
  function noOverlap() {
    const b = useHouse.getState().rooms.map((r) => {
      const bb = bbox(r.design.corners)
      return { name: r.design.name, minX: r.pos!.x - bb.w / 2, maxX: r.pos!.x + bb.w / 2, minZ: r.pos!.z - bb.d / 2, maxZ: r.pos!.z + bb.d / 2 }
    })
    for (let i = 0; i < b.length; i++)
      for (let j = i + 1; j < b.length; j++) {
        const ix = Math.min(b[i].maxX, b[j].maxX) - Math.max(b[i].minX, b[j].minX)
        const iz = Math.min(b[i].maxZ, b[j].maxZ) - Math.max(b[i].minZ, b[j].minZ)
        expect(ix > 1 && iz > 1, `${b[i].name} overlaps ${b[j].name}`).toBe(false)
      }
  }

  it('resizes a room to the requested footprint, keeping its center', () => {
    useHouse.setState({ rooms: [], activeId: null, lastRemoved: null })
    useHouse.getState().loadFlat3BHK()
    const living = useHouse.getState().rooms.find((r) => r.design.name === 'Living Room')!
    const center = { ...living.pos! }

    useHouse.getState().resizeRoom(living.id, { w: 640, l: 520 })

    const after = useHouse.getState().rooms.find((r) => r.id === living.id)!
    const bb = bbox(after.design.corners)
    expect([Math.round(bb.w), Math.round(bb.d)]).toEqual([640, 520])
    expect(after.pos).toEqual(center) // the resized room is pinned about its center
  })

  it('re-settles neighbours so no rooms overlap after enlarging one', () => {
    useHouse.setState({ rooms: [], activeId: null, lastRemoved: null })
    useHouse.getState().loadFlat3BHK()
    const master = useHouse.getState().rooms.find((r) => r.design.name === 'Master Bedroom')!
    useHouse.getState().resizeRoom(master.id, { w: 620, l: 560 }) // much bigger
    noOverlap()
  })

  it('updates the live editor store when the resized room is the ACTIVE one', () => {
    useHouse.setState({ rooms: [], activeId: null, lastRemoved: null })
    useHouse.getState().loadFlat3BHK()
    // loadFlat3BHK makes the first room (Living Room) active + loaded in useStore
    const activeId = useHouse.getState().activeId!
    useHouse.getState().resizeRoom(activeId, { w: 600, l: 480 })
    const editorBB = bbox(useStore.getState().design.corners)
    expect([Math.round(editorBB.w), Math.round(editorBB.d)]).toEqual([600, 480])
  })

  it('clamps absurdly small sizes to a usable minimum', () => {
    useHouse.setState({ rooms: [], activeId: null, lastRemoved: null })
    useHouse.getState().loadFlat3BHK()
    const bath = useHouse.getState().rooms.find((r) => r.design.name === 'Common Bath')!
    useHouse.getState().resizeRoom(bath.id, { w: 5, l: 5 })
    const bb = bbox(useHouse.getState().rooms.find((r) => r.id === bath.id)!.design.corners)
    expect(bb.w).toBeGreaterThanOrEqual(120)
    expect(bb.d).toBeGreaterThanOrEqual(120)
  })
})
