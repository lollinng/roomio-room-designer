/**
 * VIEW-ONLY SHOWCASE entry — fully built in C2-4 (read-only walkthrough of ONE
 * design, reusing Agent B's flythrough). This stub deliberately imports NOTHING
 * from the editor/library/session so the isolation guarantee holds from day one.
 */
import { createRoot } from 'react-dom/client'

createRoot(document.getElementById('root')!).render(
  <div style={{ display: 'grid', placeItems: 'center', height: '100%', textAlign: 'center', padding: 24 }}>
    <div>
      <div style={{ fontSize: 18, fontWeight: 700 }}>Roomio Showcase</div>
      <div style={{ opacity: 0.7, marginTop: 8, fontSize: 14 }}>Read-only walkthrough — coming in C2-4.</div>
    </div>
  </div>,
)
