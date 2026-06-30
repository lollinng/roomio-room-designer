// Lighting controls entry point. CLOSED by default: only a compact "💡 Light Mode" launcher
// shows. Clicking it enters Light Mode and opens the full controls panel (Time of day, Sun &
// North, Room lights). Clicking again closes it. The scene stays lit either way — only the
// controls are hidden when closed.

import { useLighting } from '../store'
import { TimeBar } from './TimeBar'
import { NorthIndicator } from './NorthIndicator'
import { LightEditor } from './LightEditor'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 10 }}>
      <div style={{ fontWeight: 600, opacity: 0.85, marginBottom: 8, letterSpacing: 0.2 }}>{title}</div>
      {children}
    </div>
  )
}

export function LightingControls({
  roomId,
  hasWindows,
  anchorRightPx = 12,
}: {
  roomId?: string
  /** whether the room has any window openings (drives the "no windows" sun notice). */
  hasWindows?: boolean
  /** right offset (px) so the launcher/panel can clear other app chrome. */
  anchorRightPx?: number
}) {
  const lightMode = useLighting((s) => s.lightMode)
  const toggleLightMode = useLighting((s) => s.toggleLightMode)

  // CLOSED (default): just a compact launcher button. Controls are hidden.
  if (!lightMode) {
    return (
      <button
        onClick={() => toggleLightMode(true)}
        title="Light Mode: open lighting controls (locks furniture so you can focus on light)"
        style={{
          position: 'fixed',
          top: 12,
          right: anchorRightPx,
          zIndex: 10,
          padding: '8px 14px',
          borderRadius: 999,
          border: '1px solid rgba(255,255,255,0.22)',
          background: 'rgba(22,24,28,0.86)',
          color: '#f4f1ea',
          font: '12px ui-sans-serif, system-ui, sans-serif',
          fontWeight: 600,
          cursor: 'pointer',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.22)',
        }}
      >
        💡 Light Mode
      </button>
    )
  }

  // OPEN: full controls panel.
  return (
    <div
      style={{
        position: 'fixed',
        top: 12,
        right: anchorRightPx,
        width: 272,
        maxHeight: 'calc(100vh - 24px)',
        overflowY: 'auto',
        borderRadius: 14,
        background: 'rgba(22,24,28,0.86)',
        color: '#f4f1ea',
        backdropFilter: 'blur(8px)',
        font: '12px ui-sans-serif, system-ui, sans-serif',
        zIndex: 10,
        boxShadow: '0 8px 28px rgba(0,0,0,0.28)',
      }}
    >
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 12px' }}>
        <span style={{ fontWeight: 700, fontSize: 13 }}>☀ Lighting</span>
        <span style={{ flex: 1 }} />
        <button
          onClick={() => toggleLightMode(false)}
          title="Close lighting controls (unlock furniture)"
          style={{
            padding: '5px 10px',
            borderRadius: 999,
            border: '1px solid rgba(255,255,255,0.22)',
            background: '#ffb454',
            color: '#1a1206',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          🔒 Light Mode
        </button>
        <button
          onClick={() => toggleLightMode(false)}
          aria-label="Close lighting panel"
          style={{
            width: 24,
            height: 24,
            borderRadius: 7,
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(255,255,255,0.08)',
            color: '#f4f1ea',
            cursor: 'pointer',
          }}
        >
          ✕
        </button>
      </div>

      <div
        style={{
          margin: '0 12px 6px',
          padding: '5px 9px',
          borderRadius: 8,
          background: 'rgba(255,180,84,0.16)',
          color: '#ffd9a0',
          fontWeight: 600,
        }}
      >
        🔒 Furniture locked — editing paused
      </div>

      <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Section title="Time of day">
          <TimeBar hasWindows={hasWindows} />
        </Section>
        <Section title="Sun & North">
          <NorthIndicator />
        </Section>
        {roomId && (
          <Section title="Room lights">
            <LightEditor roomId={roomId} />
          </Section>
        )}
      </div>
    </div>
  )
}
