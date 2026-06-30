// Per-room light editor — proves lights are editable (move via intensity/warmth here;
// recolor; delete; swap warmth). Move/position editing in 3D is the app's gizmo job;
// this panel covers intensity / warm-cool / enable / delete + add-accent.

import { useLighting } from '../store'
import type { Warmth } from '../types'
import { warmthToHex } from '../colorTemp'

export function LightEditor({ roomId }: { roomId: string }) {
  const room = useLighting((s) => s.rooms[roomId])
  const updateLight = useLighting((s) => s.updateLight)
  const removeLight = useLighting((s) => s.removeLight)
  const setRoomWarmth = useLighting((s) => s.setRoomWarmth)
  const addLight = useLighting((s) => s.addLight)

  if (!room) return null

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, alignItems: 'center' }}>
        <span style={{ opacity: 0.7 }}>Warmth:</span>
        {(['warm', 'neutral', 'cool'] as Warmth[]).map((w) => (
          <button
            key={w}
            onClick={() => setRoomWarmth(roomId, w)}
            title={w}
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.3)',
              background: warmthToHex(w),
              cursor: 'pointer',
            }}
          />
        ))}
      </div>

      {room.lights.map((l) => (
        <div key={l.id} style={{ marginBottom: 8, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>
              <span style={{ opacity: 0.6 }}>[{l.layer}]</span> {l.type}
            </span>
            <span style={{ display: 'flex', gap: 4 }}>
              <input
                type="checkbox"
                checked={l.enabled !== false}
                onChange={(e) => updateLight(roomId, l.id, { enabled: e.target.checked })}
                title="on/off"
              />
              <button
                onClick={() => removeLight(roomId, l.id)}
                style={{ background: 'none', border: 'none', color: '#ff8a6a', cursor: 'pointer' }}
                title="delete"
              >
                🗑
              </button>
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={2}
            step={0.05}
            value={l.intensity}
            onChange={(e) => updateLight(roomId, l.id, { intensity: parseFloat(e.target.value) })}
            style={{ width: '100%', accentColor: l.color }}
            aria-label={`${l.id} intensity`}
          />
        </div>
      ))}

      <button
        onClick={() =>
          addLight(roomId, {
            id: `${roomId}__accent_${Date.now()}`,
            type: 'wall_wash',
            layer: 'accent',
            warmth: 'warm',
            color: warmthToHex('warm'),
            intensity: 0.4,
            pos: [0, 1.8, -1.6],
            target: [0, 0, -2],
            enabled: true,
          })
        }
        style={{
          marginTop: 6,
          width: '100%',
          background: 'rgba(255,255,255,0.12)',
          color: '#f4f1ea',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 8,
          padding: '5px 8px',
          cursor: 'pointer',
        }}
      >
        + Add accent light
      </button>
    </div>
  )
}
