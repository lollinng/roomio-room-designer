import { describe, it, expect, beforeEach } from 'vitest'
import { useSession, makeSession } from './session'
import { InMemoryAdapter, type StorageAdapter } from '../storage/adapter'
import { sampleBedroom } from '../demo/sampleScene'
import type { RoomioDesign } from '../envelope/types'

// Rebind the singleton to a fresh in-memory backend before each test.
beforeEach(() => {
  useSession.setState(makeSession(new InMemoryAdapter()))
})

const S = () => useSession.getState()

/** Adapter whose setItem can be held open, to simulate a slow/in-flight save. */
class GatedAdapter implements StorageAdapter {
  readonly kind = 'gated'
  private inner = new InMemoryAdapter()
  private gate: Promise<void> | null = null
  private release: (() => void) | null = null
  open() {
    this.gate = new Promise((r) => (this.release = r))
  }
  unblock() {
    this.release?.()
    this.gate = null
    this.release = null
  }
  async getItem(k: string) {
    return this.inner.getItem(k)
  }
  async setItem(k: string, v: string) {
    if (this.gate) await this.gate
    return this.inner.setItem(k, v)
  }
  async removeItem(k: string) {
    return this.inner.removeItem(k)
  }
  async keys(prefix: string) {
    return this.inner.keys(prefix)
  }
}

/** Use rooms[0].interior.name as a scene marker we can set + assert. */
const marker = (d: RoomioDesign | null) => d?.scene.house.rooms[0]?.interior.name
const setMarker = (m: string) => (d: RoomioDesign): RoomioDesign => ({
  ...d,
  scene: {
    ...d.scene,
    house: {
      ...d.scene.house,
      rooms: d.scene.house.rooms.map((r, i) =>
        i === 0 ? { ...r, interior: { ...r.interior, name: m } } : r,
      ),
    },
  },
})

describe('session — library management', () => {
  it('creates a design, then duplicates it as an independent private copy', async () => {
    const d = await S().newDesign(sampleBedroom(), null, 'Original')
    await S().closeToLibrary()
    expect(S().summaries.map((s) => s.name)).toContain('Original')

    const copyId = await S().duplicate(d.design_id)
    expect(copyId).not.toBeNull()
    await S().refreshLibrary()
    const names = S().summaries.map((s) => s.name)
    expect(names).toContain('Original')
    expect(names).toContain('Original (copy)')

    const copy = await S().repo.load(copyId!)
    expect(copy!.share.access).toBe('private') // never inherits share links
    expect(copy!.design_id).not.toBe(d.design_id)
  })

  it('renames a design by id', async () => {
    const d = await S().newDesign(sampleBedroom(), null, 'Before')
    await S().closeToLibrary()
    await S().renameDesign(d.design_id, 'After')
    const reloaded = await S().repo.load(d.design_id)
    expect(reloaded!.name).toBe('After')
  })

  it('delete is UNDOable — the design returns intact', async () => {
    const d = await S().newDesign(sampleBedroom(), null, 'Fragile')
    await S().closeToLibrary()
    await S().deleteDesign(d.design_id)
    expect(await S().repo.has(d.design_id)).toBe(false)
    expect(S().lastDeleted?.design_id).toBe(d.design_id)

    await S().undoDelete()
    expect(await S().repo.has(d.design_id)).toBe(true)
    const back = await S().repo.load(d.design_id)
    expect(back!.name).toBe('Fragile')
    expect(S().lastDeleted).toBeNull()
  })

  it('deleting the currently-open design returns to the library', async () => {
    const d = await S().newDesign(sampleBedroom(), null, 'Open one')
    expect(S().current?.design_id).toBe(d.design_id)
    await S().deleteDesign(d.design_id)
    expect(S().current).toBeNull()
  })
})

describe('session — edit during in-flight save is never clobbered (regression: critical #2)', () => {
  it('keeps + persists the newer edit when it lands while an older save is in flight', async () => {
    const gated = new GatedAdapter()
    useSession.setState(makeSession(gated))
    const d = await S().newDesign(sampleBedroom(), null, 'Start')

    gated.open() // hold the next save open
    S().mutate(setMarker('A'))
    const saving = S().saveNow() // flush starts saving scene A, awaits the gate
    S().mutate(setMarker('B')) // NEWER edit arrives mid-flight (optimistic)
    expect(marker(S().current)).toBe('B') // shown immediately
    gated.unblock()
    await saving

    // onSaved for A must NOT snap the visible scene back to A.
    expect(marker(S().current)).toBe('B')

    // The newer scene B must actually reach storage (coalesced re-save).
    let stored = await S().repo.load(d.design_id)
    for (let i = 0; i < 20 && marker(stored) !== 'B'; i++) {
      await new Promise((r) => setTimeout(r, 10))
      stored = await S().repo.load(d.design_id)
    }
    expect(marker(stored)).toBe('B')
    expect(S().current?.scene.house.rooms[0].interior.name).toBe('B')
  })
})
