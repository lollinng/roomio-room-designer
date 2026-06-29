// North indicator (Pillar 3). Rotating it offsets the sun azimuth; Reverse flips 180°.
// Toggles independently of the time bar. DOM overlay.

import { useLighting } from '../store'

export function NorthIndicator() {
  const northOffsetDeg = useLighting((s) => s.northOffsetDeg)
  const rotateNorth = useLighting((s) => s.rotateNorth)
  const reverseNorth = useLighting((s) => s.reverseNorth)
  const setNorthOffset = useLighting((s) => s.setNorthOffset)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        borderRadius: 12,
        background: 'rgba(20,22,26,0.78)',
        color: '#f4f1ea',
        backdropFilter: 'blur(6px)',
        font: '12px ui-sans-serif, system-ui, sans-serif',
        width: 120,
      }}
    >
      <div style={{ fontWeight: 600 }}>North</div>
      {/* compass dial; the N arrow rotates with northOffset */}
      <div
        style={{
          position: 'relative',
          width: 64,
          height: 64,
          borderRadius: '50%',
          border: '2px solid rgba(255,255,255,0.35)',
          transform: `rotate(${northOffsetDeg}deg)`,
          transition: 'transform 0.15s ease',
        }}
        aria-label={`North offset ${Math.round(northOffsetDeg)} degrees`}
      >
        <div
          style={{
            position: 'absolute',
            top: 2,
            left: '50%',
            transform: 'translateX(-50%)',
            color: '#ff6b4a',
            fontWeight: 700,
          }}
        >
          N
        </div>
        <div style={{ position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)', opacity: 0.5 }}>
          S
        </div>
      </div>
      <div style={{ opacity: 0.7 }}>{Math.round(northOffsetDeg)}°</div>
      <div style={{ display: 'flex', gap: 4 }}>
        <button onClick={() => rotateNorth(-15)} style={btn} aria-label="Rotate north counter-clockwise">
          ⟲
        </button>
        <button onClick={() => rotateNorth(15)} style={btn} aria-label="Rotate north clockwise">
          ⟳
        </button>
      </div>
      <button onClick={reverseNorth} style={{ ...btn, width: '100%' }}>
        Reverse 180°
      </button>
      <input
        type="range"
        min={0}
        max={359}
        step={1}
        value={northOffsetDeg}
        onChange={(e) => setNorthOffset(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: '#ff6b4a' }}
        aria-label="North rotation"
      />
    </div>
  )
}

const btn: React.CSSProperties = {
  background: 'rgba(255,255,255,0.12)',
  color: '#f4f1ea',
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: 8,
  padding: '4px 8px',
  cursor: 'pointer',
  font: '13px ui-sans-serif',
}
