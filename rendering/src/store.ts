// Render-settings store (zustand) — mirrors Agent E's store pattern. Holds the live
// RenderSettings + transient hero-render state. The drop-in rig reads this; a <RenderControls>
// UI (G4) and the app both drive it.

import { create } from 'zustand'
import type {
  RenderSettings,
  RenderQuality,
  PartialRenderSettings,
  AOSettings,
  BloomSettings,
} from './types'
import { presetFor, DEFAULT_RENDER_SETTINGS, withOverrides } from './presets'

export interface RenderStore {
  settings: RenderSettings
  /** True while a path-traced hero still is accumulating — suspends the raster post pipeline. */
  heroActive: boolean

  setQuality: (q: RenderQuality) => void
  setExposure: (e: number) => void
  /** Global IBL strength (scene.environmentIntensity). */
  setEnvIntensity: (i: number) => void
  setBloom: (patch: Partial<BloomSettings>) => void
  setAO: (patch: Partial<AOSettings>) => void
  setHeroEnabled: (b: boolean) => void
  setHeroActive: (b: boolean) => void
  /** Forward-compatible bulk patch (e.g. hydrating from a saved RenderSettings subset). */
  patch: (p: PartialRenderSettings) => void
}

export const useRender = create<RenderStore>((set) => ({
  settings: DEFAULT_RENDER_SETTINGS,
  heroActive: false,

  setQuality: (q) =>
    set((s) => {
      // Switching tier resets the post passes to the preset, but PRESERVES the user's
      // foundation tunings (tone-mapping exposure + IBL intensity — the E co-tune values),
      // so dropping to "low" for perf doesn't throw away a tuned exposure.
      const preset = presetFor(q)
      preset.toneMapping.exposure = s.settings.toneMapping.exposure
      preset.ibl.intensity = s.settings.ibl.intensity
      preset.materials = { ...s.settings.materials }
      return { settings: preset }
    }),

  setExposure: (e) =>
    set((s) => ({ settings: { ...s.settings, toneMapping: { ...s.settings.toneMapping, exposure: e } } })),

  setEnvIntensity: (i) =>
    set((s) => ({ settings: { ...s.settings, ibl: { ...s.settings.ibl, intensity: i } } })),

  setBloom: (p) =>
    set((s) => ({ settings: { ...s.settings, post: { ...s.settings.post, bloom: { ...s.settings.post.bloom, ...p } } } })),

  setAO: (p) =>
    set((s) => ({ settings: { ...s.settings, post: { ...s.settings.post, ao: { ...s.settings.post.ao, ...p } } } })),

  setHeroEnabled: (b) =>
    set((s) => ({ settings: { ...s.settings, heroRender: { ...s.settings.heroRender, enabled: b } } })),

  setHeroActive: (b) => set({ heroActive: b }),

  patch: (p) => set((s) => ({ settings: withOverrides(s.settings, p) })),
}))
