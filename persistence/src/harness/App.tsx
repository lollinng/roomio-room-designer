/**
 * Demo harness root — routes between the My Designs library and the editor based
 * on whether a design is open, and installs the unsaved-exit guard. This is the
 * standalone app that proves persistence end-to-end; in the real product these
 * screens compose with Agent A's editor.
 *
 * The Share panel + view-only showcase land in C2-4; for now the Share button
 * opens a placeholder so the editor flow is navigable.
 */
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { useSession, installSessionUnloadGuard } from '../app/session'
import { Library } from './Library'
import { Editor } from './Editor'
import { T, panel, btnGhost } from '../ui/theme'

export function App() {
  const current = useSession((s) => s.current)
  const [shareOpen, setShareOpen] = useState(false)

  useEffect(() => installSessionUnloadGuard(), [])

  return (
    <div style={root}>
      {current ? <Editor onShare={() => setShareOpen(true)} /> : <Library />}
      {shareOpen && (
        <div style={overlay} onClick={() => setShareOpen(false)}>
          <div style={{ ...panel, padding: 24, maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>Share</div>
            <p style={{ color: T.inkSoft, fontSize: 13 }}>
              Share panel, view-only showcase link, and exports arrive in milestone C2-4 / C2-5.
            </p>
            <button style={btnGhost} onClick={() => setShareOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}

const root: CSSProperties = { height: '100%', background: T.bg, color: T.ink, font: '14px ui-sans-serif, system-ui, -apple-system, sans-serif' }
const overlay: CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(20,18,16,0.32)', display: 'grid', placeItems: 'center', zIndex: 50 }
