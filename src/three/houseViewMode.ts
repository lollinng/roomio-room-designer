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
}

export const useHouseView = create<HouseViewState>((set) => ({
  mode: 'room',
  setMode: (mode) => set({ mode }),
  toggle: () => set((s) => ({ mode: s.mode === 'room' ? 'house' : 'room' })),
}))
