/**
 * Session store (zustand) — ties the repository + autosave engine + the open
 * design together. This is the brain the UI binds to.
 *
 * Optimistic UI: edits mutate `current` IN MEMORY immediately (instant), and the
 * autosave engine persists in the background with a visible status. rev increments
 * once per successful durable save (strictly monotonic).
 */
import { create } from 'zustand'
import type { RoomioDesign, DesignSummary } from '../envelope/types'
import { createDesign } from '../envelope/factory'
import type { House, LightingStateLike } from '../scene/slices'
import { DesignRepository } from '../storage/repository'
import { LocalStorageAdapter, type StorageAdapter } from '../storage/adapter'
import { AutosaveController } from '../autosave/engine'
import type { SaveStatus } from '../autosave/status'
import { installUnloadGuard } from '../autosave/beforeUnload'
import { captureThumbnail } from '../render/thumbnail'
import { makeSnapshot, pushHistory, shouldAutoSnapshot, restoreFrom } from '../envelope/history'
import type { VersionSnapshot } from '../envelope/types'

/** Adapters that support fault injection (the demo "simulate save failure"). */
interface FaultInjectable {
  setFailing(on: boolean): void
  readonly failing: boolean
}
function asFault(a: StorageAdapter): FaultInjectable | null {
  const f = a as unknown as Partial<FaultInjectable>
  return typeof f.setFailing === 'function' ? (f as FaultInjectable) : null
}

export interface SessionState {
  repo: DesignRepository
  autosave: AutosaveController<RoomioDesign>
  backend: string
  /** The open design (optimistic in-memory model). null = on the library screen. */
  current: RoomioDesign | null
  status: SaveStatus
  /** Library summaries (refreshed after every successful save / mutation). */
  summaries: DesignSummary[]
  /** True when the storage backend supports the demo failure simulation. */
  canSimulateFailure: boolean
  failureSimOn: boolean

  // lifecycle
  refreshLibrary: () => Promise<void>
  // creation / navigation
  newDesign: (house: House, lighting?: LightingStateLike | null, name?: string) => Promise<RoomioDesign>
  open: (id: string) => Promise<boolean>
  closeToLibrary: () => Promise<void>
  // editing (optimistic + autosave)
  rename: (name: string) => void
  mutate: (producer: (d: RoomioDesign) => RoomioDesign) => void
  saveNow: () => Promise<void>
  // version history
  checkpoint: (label?: string) => Promise<void>
  restoreVersion: (rev: number) => void
  history: () => VersionSnapshot[]
  // demo: simulate a storage outage
  simulateSaveFailure: (on: boolean) => void
}

/** Build the autosave controller, wiring its save fn through the repository. */
function makeAutosave(getRepo: () => DesignRepository, onSaved: (committed: RoomioDesign) => void) {
  return new AutosaveController<RoomioDesign>({
    debounceMs: 1200,
    save: async (env) => {
      const now = Date.now()
      let committed: RoomioDesign = {
        ...env,
        updatedAt: now,
        rev: Math.max(env.rev, currentRev() + 1),
        thumbnail: captureThumbnail(env.scene.house) ?? env.thumbnail,
      }
      // Periodic autosnapshot (throttled) so a bad edit can always be rolled back.
      if (shouldAutoSnapshot(committed, now)) {
        committed = pushHistory(committed, makeSnapshot(committed, 'auto', now))
      }
      await getRepo().save(committed)
      onSaved(committed)
    },
    onStatus: (s) => useSession.setState({ status: s }),
  })
}

let currentRevFn: () => number = () => 0
function currentRev(): number {
  return currentRevFn()
}

export function makeSession(adapter: StorageAdapter = new LocalStorageAdapter()): SessionState {
  const repo = new DesignRepository(adapter)
  const fault = asFault(adapter)
  const autosave = makeAutosave(
    () => repo,
    (committed) => {
      // Reflect the durable rev/updatedAt back into the optimistic model.
      const st = useSession.getState()
      if (st.current?.design_id === committed.design_id) {
        useSession.setState({ current: committed })
      }
      void st.refreshLibrary()
    },
  )
  return {
    repo,
    autosave,
    backend: repo.backend,
    current: null,
    status: { phase: 'idle' },
    summaries: [],
    canSimulateFailure: !!fault,
    failureSimOn: false,

    refreshLibrary: async () => {
      const summaries = await useSession.getState().repo.list()
      useSession.setState({ summaries, backend: useSession.getState().repo.backend })
    },

    newDesign: async (house, lighting = null, name) => {
      const base = createDesign({ house, lighting, name })
      const d: RoomioDesign = { ...base, thumbnail: captureThumbnail(house) ?? null }
      useSession.setState({ current: d })
      await useSession.getState().repo.save(d)
      await useSession.getState().refreshLibrary()
      useSession.setState({ status: { phase: 'saved', savedAt: Date.now() } })
      return d
    },

    open: async (id) => {
      const d = await useSession.getState().repo.load(id)
      if (!d) return false
      useSession.setState({ current: d, status: { phase: 'saved', savedAt: d.updatedAt } })
      return true
    },

    closeToLibrary: async () => {
      // Flush any pending edits before leaving so nothing is lost.
      await useSession.getState().autosave.saveNow()
      useSession.setState({ current: null })
      await useSession.getState().refreshLibrary()
    },

    rename: (name) => {
      useSession.getState().mutate((d) => ({ ...d, name }))
    },

    mutate: (producer) => {
      const st = useSession.getState()
      if (!st.current) return
      const next = producer(st.current)
      useSession.setState({ current: next }) // optimistic: instant
      st.autosave.markDirty(next) // persist in background
    },

    saveNow: async () => {
      await useSession.getState().autosave.saveNow()
    },

    // ── version history ──
    checkpoint: async (label) => {
      const st = useSession.getState()
      if (!st.current) return
      // A manual checkpoint doubles as a named restore point (brief §3).
      const snapped = pushHistory(st.current, makeSnapshot(st.current, 'manual', Date.now(), label))
      useSession.setState({ current: snapped })
      st.autosave.markDirty(snapped)
      await st.autosave.saveNow()
    },

    restoreVersion: (rev) => {
      const st = useSession.getState()
      if (!st.current) return
      const restored = restoreFrom(st.current, rev)
      if (!restored) return
      // Restoring is itself an edit → saved as a new rev; history is preserved.
      useSession.setState({ current: restored })
      st.autosave.markDirty(restored)
    },

    history: () => useSession.getState().current?.history ?? [],

    // ── demo: simulate a storage outage ──
    simulateSaveFailure: (on) => {
      fault?.setFailing(on)
      useSession.setState({ failureSimOn: on })
      // When recovering, nudge a flush so the kept-in-memory data lands immediately.
      if (!on) void useSession.getState().autosave.saveNow()
    },
  }
}

export const useSession = create<SessionState>(() => makeSession())

// rev source for the autosave commit step
currentRevFn = () => useSession.getState().current?.rev ?? 0

/** Install the unsaved-exit guard once (call from the app root). Returns cleanup. */
export function installSessionUnloadGuard(): () => void {
  return installUnloadGuard(() => useSession.getState().autosave.hasUnsaved())
}
