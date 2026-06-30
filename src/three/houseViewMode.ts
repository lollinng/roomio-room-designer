/**
 * Whole-house view mode (Agent E, multi-room). A tiny store so the viewport can
 * switch between editing ONE room and an overview of the whole interconnected
 * house. Separate from Agent C's houseSession so neither file depends on the other.
 */
import { create } from 'zustand'

export type ViewMode = 'room' | 'house'

interface HouseViewState {
  mode: ViewMode
  setMode: (m: ViewMode) => void
  toggle: () => void
  /** debug: draw the flythrough collision footprints as wireframes so you can SEE
   *  the otherwise-invisible walls — the standard way to test "invisible wall"
   *  collision bugs (verify colliders line up with the rendered geometry). */
  debugColliders: boolean
  toggleDebugColliders: () => void
  /** bump to snap the camera to a top-down 2D "plan" view (2D↔3D toggle). */
  planNonce: number
  requestPlanView: () => void
}

export const useHouseView = create<HouseViewState>((set) => ({
  mode: 'room',
  setMode: (mode) => set({ mode }),
  toggle: () => set((s) => ({ mode: s.mode === 'room' ? 'house' : 'room' })),
  debugColliders: false,
  toggleDebugColliders: () => set((s) => ({ debugColliders: !s.debugColliders })),
  planNonce: 0,
  requestPlanView: () => set((s) => ({ planNonce: s.planNonce + 1 })),
}))
