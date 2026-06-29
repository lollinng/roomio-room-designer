// Overlay that hosts the lighting controls. The time bar and the north indicator toggle
// INDEPENDENTLY (acceptance L-10). Hiding them does not change the scene's lighting.

import { useLighting } from '../store'
import { TimeBar } from './TimeBar'
import { NorthIndicator } from './NorthIndicator'
import { LightEditor } from './LightEditor'

const chip = (active: boolean): React.CSSProperties => ({
  padding: '6px 12px',
  borderRadius: 999,
  border: '1px solid rgba(255,255,255,0.25)',
  background: active ? '#ffb454' : 'rgba(20,22,26,0.78)',
  color: active ? '#1a1206' : '#f4f1ea',
  cursor: 'pointer',
  font: '12px ui-sans-serif, system-ui, sans-serif',
  fontWeight: 600,
  backdropFilter: 'blur(6px)',
})

export function LightingControls({ roomId }: { roomId?: string }) {
  const barVisible = useLighting((s) => s.barVisible)
  const northVisible = useLighting((s) => s.northVisible)
  const lightMode = useLighting((s) => s.lightMode)
  const toggleBar = useLighting((s) => s.toggleBar)
  const toggleNorth = useLighting((s) => s.toggleNorth)
  const toggleLightMode = useLighting((s) => s.toggleLightMode)

  return (
    <>
      {/* top-left: independent toggles (always visible, so you can re-show panels) */}
      <div style={{ position: 'fixed', top: 12, left: 12, display: 'flex', gap: 8, zIndex: 10 }}>
        <button
          style={chip(lightMode)}
          onClick={() => toggleLightMode()}
          title="Lock furniture and hide editing hints so you can focus on lighting"
        >
          💡 Light Mode
        </button>
        <button style={chip(barVisible)} onClick={() => toggleBar()}>
          Time bar
        </button>
        <button style={chip(northVisible)} onClick={() => toggleNorth()}>
          North
        </button>
      </div>

      {/* light-mode banner: furniture is locked */}
      {lightMode && (
        <div
          style={{
            position: 'fixed',
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10,
            padding: '6px 14px',
            borderRadius: 999,
            background: 'rgba(20,22,26,0.78)',
            color: '#ffd9a0',
            backdropFilter: 'blur(6px)',
            font: '12px ui-sans-serif, system-ui, sans-serif',
            fontWeight: 600,
          }}
        >
          🔒 Light Mode — furniture locked
        </div>
      )}

      {/* top-right: light editor for the active room */}
      {roomId && (
        <div style={{ position: 'fixed', top: 12, right: 12, zIndex: 10 }}>
          <LightEditor roomId={roomId} />
        </div>
      )}

      {/* right-center: north indicator (independent toggle) */}
      {northVisible && (
        <div style={{ position: 'fixed', top: '45%', right: 12, transform: 'translateY(-50%)', zIndex: 10 }}>
          <NorthIndicator />
        </div>
      )}

      {/* bottom-center: time bar (independent toggle) */}
      {barVisible && (
        <div style={{ position: 'fixed', bottom: 18, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
          <TimeBar />
        </div>
      )}
    </>
  )
}
