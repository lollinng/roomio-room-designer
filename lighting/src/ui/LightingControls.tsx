// Single, consolidated Lighting panel (replaces the old scattered chips / floating compass /
// bottom bar / center banner). One docked card on the right with clear sections:
//   • Light Mode switch (header)   • Time of day   • Sun & North compass   • Room lights
// Collapsible so it never crowds the scene ("hide controls -> scene still renders").

import { useState } from 'react'
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
  /** right offset (px) so the panel can clear other app chrome. */
  anchorRightPx?: number
}) {
  const lightMode = useLighting((s) => s.lightMode)
  const toggleLightMode = useLighting((s) => s.toggleLightMode)
  const [open, setOpen] = useState(true)

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
          onClick={() => toggleLightMode()}
          title="Light Mode: lock furniture and hide editing hints so you can focus on lighting"
          style={{
            padding: '5px 10px',
            borderRadius: 999,
            border: '1px solid rgba(255,255,255,0.22)',
            background: lightMode ? '#ffb454' : 'rgba(255,255,255,0.1)',
            color: lightMode ? '#1a1206' : '#f4f1ea',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {lightMode ? '🔒 Light Mode' : '💡 Light Mode'}
        </button>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Collapse lighting panel' : 'Expand lighting panel'}
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
          {open ? '▾' : '▸'}
        </button>
      </div>

      {lightMode && (
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
      )}

      {open && (
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
      )}
    </div>
  )
}
