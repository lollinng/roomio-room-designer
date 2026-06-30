import { describe, it, expect, beforeEach } from 'vitest'
import { useStore, newDesign } from './store'
import { ARCHETYPE_MAP } from './data/archetypes'
import type { FurnitureItem, RoomDesign } from './types'

let n = 0
function place(archetype: string, x: number, z: number, extra: Partial<FurnitureItem> = {}): FurnitureItem {
  const a = ARCHETYPE_MAP[archetype]
  return {
    id: `${archetype}-${n++}`,
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
    ...extra,
  }
}

function designWith(furniture: FurnitureItem[]): RoomDesign {
  return { ...newDesign('rect'), furniture }
}

describe('mounted pieces follow their host when it moves', () => {
  beforeEach(() => {
    // big rectangular room so moves aren't clamped by walls
    useStore.setState({ interacting: false })
  })

  it('a table lamp travels with the side table it sits on (translation)', () => {
    const table = place('table-side', 300, 300)
    const lamp = place('decor-lamp-table', 300, 300) // sits on the table
    useStore.getState().loadDesign(designWith([table, lamp]))

    useStore.getState().updateFurniture(table.id, { x: 360, z: 340 })
    const after = useStore.getState().design.furniture
    const movedLamp = after.find((f) => f.id === lamp.id)!
    expect(movedLamp.x).toBeCloseTo(360, 5)
    expect(movedLamp.z).toBeCloseTo(340, 5)
  })

  it('a locked lamp still follows its table (lock binds it to the surface)', () => {
    const table = place('table-side', 200, 200)
    const lamp = place('decor-lamp-table', 200, 200, { locked: true })
    useStore.getState().loadDesign(designWith([table, lamp]))

    useStore.getState().updateFurniture(table.id, { x: 250 })
    const movedLamp = useStore.getState().design.furniture.find((f) => f.id === lamp.id)!
    expect(movedLamp.x).toBeCloseTo(250, 5)
  })

  it('a TV rotates around its console when the console is rotated', () => {
    const console = place('storage-media', 300, 100)
    // TV offset 40cm to the right of the console center, resting on it
    const tv = place('decor-tv', 340, 100)
    useStore.getState().loadDesign(designWith([console, tv]))

    useStore.getState().updateFurniture(console.id, { rotation: Math.PI / 2 })
    const movedTv = useStore.getState().design.furniture.find((f) => f.id === tv.id)!
    // a +90° Y-rotation maps the +x offset (40,0) to (0,-40) under the app's
    // footprint convention → TV ends up 40cm toward -z of the console center.
    expect(movedTv.x).toBeCloseTo(300, 3)
    expect(movedTv.z).toBeCloseTo(60, 3)
    expect(movedTv.rotation).toBeCloseTo(Math.PI / 2, 5)
  })

  it('a free-standing item is NOT dragged by an unrelated move', () => {
    const table = place('table-side', 100, 100)
    const farLamp = place('decor-lamp-table', 480, 360) // not on the table
    useStore.getState().loadDesign(designWith([table, farLamp]))

    useStore.getState().updateFurniture(table.id, { x: 140 })
    const lamp = useStore.getState().design.furniture.find((f) => f.id === farLamp.id)!
    expect(lamp.x).toBeCloseTo(480, 5)
    expect(lamp.z).toBeCloseTo(360, 5)
  })
})
