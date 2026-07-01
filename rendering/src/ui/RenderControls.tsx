// RenderControls — the app-facing render panel (mirrors E's <LightingControls>). A small docked,
// collapsible panel: quality (high/medium/low), exposure (the ACES compensation knob), and IBL
// strength. Render settings are GLOBAL (not per-room), so this reads/writes the useRender store
// directly. `anchor*` props let the mount clear other app chrome (E's top-right panel, B's HUD,
// the top-centre toolbar) — same pattern E exposed.

import { useState, type CSSProperties } from 'react'
import { useRender } from '../store'
import { getHeroExporter } from '../r3f/heroBus'
import type { RenderQuality } from '../types'

export interface RenderControlsProps {
  anchorLeftPx?: number
  anchorBottomPx?: number
}

const QUALITIES: RenderQuality[] = ['high', 'medium', 'low']

function pill(active: boolean): CSSProperties {
  return {
    padding: '5px 11px',
    borderRadius: 999,
    border: '1px solid rgba(0,0,0,0.12)',
    background: active ? '#111' : '#fff',
    color: active ? '#fff' : '#23211e',
    font: '12px ui-sans-serif, system-ui, sans-serif',
    fontWeight: 700,
    cursor: 'pointer',
  }
}

export function RenderControls({ anchorLeftPx = 12, anchorBottomPx = 12 }: RenderControlsProps) {
  const [open, setOpen] = useState(true)
  const quality = useRender((s) => s.settings.quality)
  const exposure = useRender((s) => s.settings.toneMapping.exposure)
  const envIntensity = useRender((s) => s.settings.ibl.intensity)
  const setQuality = useRender((s) => s.setQuality)
  const setExposure = useRender((s) => s.setExposure)
  const setEnvIntensity = useRender((s) => s.setEnvIntensity)
  const lightsOn = useRender((s) => s.lightsOn)
  const toggleLights = useRender((s) => s.toggleLights)
  const heroActive = useRender((s) => s.heroActive)
  const heroSamples = useRender((s) => s.heroSamples)
  const heroSupported = useRender((s) => s.heroSupported)
  const heroTarget = useRender((s) => s.settings.heroRender.samples)
  const setHeroActive = useRender((s) => s.setHeroActive)

  const converged = heroActive && heroSamples >= heroTarget
  const downloadHero = () => {
    const url = getHeroExporter()?.()
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = 'roomio-hero.png'
    a.click()
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: anchorLeftPx,
        bottom: anchorBottomPx,
        zIndex: 9,
        width: 232,
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(6px)',
        borderRadius: 12,
        boxShadow: '0 6px 24px rgba(0,0,0,0.18)',
        border: '1px solid rgba(0,0,0,0.08)',
        font: '12px ui-sans-serif, system-ui, sans-serif',
        color: '#23211e',
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Toggle render quality panel"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          font: '700 13px ui-sans-serif, system-ui, sans-serif',
          color: '#23211e',
        }}
      >
        <span>🎬 Render</span>
        <span style={{ opacity: 0.6 }}>{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={toggleLights}
            aria-pressed={lightsOn}
            title="Turn the scene's lights on/off"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 11px',
              borderRadius: 8,
              border: '1px solid rgba(0,0,0,0.12)',
              background: lightsOn ? '#111' : '#fff',
              color: lightsOn ? '#fff' : '#23211e',
              font: '700 12px ui-sans-serif, system-ui, sans-serif',
              cursor: 'pointer',
            }}
          >
            <span>{lightsOn ? '💡 Lights on' : '🌙 Lights off'}</span>
            <span style={{ opacity: 0.6, fontWeight: 400 }}>{lightsOn ? 'tap to turn off' : 'tap to turn on'}</span>
          </button>

          <div>
            <div style={{ opacity: 0.65, marginBottom: 5 }}>Quality</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {QUALITIES.map((q) => (
                <button key={q} style={pill(quality === q)} aria-pressed={quality === q} onClick={() => setQuality(q)}>
                  {q}
                </button>
              ))}
            </div>
          </div>

          <label style={{ display: 'block' }}>
            <div style={{ opacity: 0.65, marginBottom: 3, display: 'flex', justifyContent: 'space-between' }}>
              <span>Exposure</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{exposure.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.05}
              value={exposure}
              onChange={(e) => setExposure(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </label>

          <label style={{ display: 'block' }}>
            <div style={{ opacity: 0.65, marginBottom: 3, display: 'flex', justifyContent: 'space-between' }}>
              <span>Reflections (IBL)</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{envIntensity.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={1.2}
              step={0.05}
              value={envIntensity}
              onChange={(e) => setEnvIntensity(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </label>

          {/* Hero render (G5) — progressive path-traced still while the camera is static. */}
          <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: 10 }}>
            <div style={{ opacity: 0.65, marginBottom: 5 }}>Beauty shot (path-traced)</div>
            {!heroSupported ? (
              <div style={{ opacity: 0.6, fontSize: 11 }}>Needs a WebGL2 GPU — not available here.</div>
            ) : !heroActive ? (
              <button style={pill(false)} onClick={() => setHeroActive(true)}>
                🎥 Render beauty shot
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {converged
                    ? `✓ Converged ${heroTarget}/${heroTarget} samples`
                    : heroSamples === 0
                      ? 'Preparing… (building scene)'
                      : `Rendering… ${heroSamples}/${heroTarget} samples`}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {converged && (
                    <button style={pill(true)} onClick={downloadHero}>
                      ⬇ Download PNG
                    </button>
                  )}
                  <button style={pill(false)} onClick={() => setHeroActive(false)}>
                    {converged ? 'Back to live' : 'Cancel'}
                  </button>
                </div>
                <div style={{ opacity: 0.55, fontSize: 10 }}>Moving the camera returns to the live view.</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
