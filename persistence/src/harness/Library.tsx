/**
 * "My Designs" library — the home base users return to (brief §4). Grid of cards
 * (thumbnail + name + last-edited) with open / rename / duplicate / delete+undo.
 * NOTE: C2-1 ships a navigable baseline; full card actions land in C2-3.
 */
import { useEffect } from 'react'
import type { CSSProperties } from 'react'
import { useSession } from '../app/session'
import { savedLabel } from '../autosave/status'
import { T, panel, btnPrimary } from '../ui/theme'
import { sampleBedroom, sampleTwoRoom, sampleLighting } from '../demo/sampleScene'

export function Library() {
  const summaries = useSession((s) => s.summaries)
  const refreshLibrary = useSession((s) => s.refreshLibrary)
  const open = useSession((s) => s.open)
  const newDesign = useSession((s) => s.newDesign)
  const backend = useSession((s) => s.backend)

  useEffect(() => {
    void refreshLibrary()
  }, [refreshLibrary])

  const createBedroom = () => {
    const h = sampleBedroom()
    void newDesign(h, sampleLighting(h.rooms.map((r) => r.room_id)))
  }
  const createApartment = () => {
    const h = sampleTwoRoom()
    void newDesign(h, sampleLighting(h.rooms.map((r) => r.room_id)))
  }

  return (
    <div style={shell}>
      <header style={head}>
        <div>
          <h1 style={title}>My Designs</h1>
          <div style={sub}>{summaries.length} saved · storage: {backend}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={btnPrimary} onClick={createBedroom}>+ New room</button>
          <button style={btnPrimary} onClick={createApartment}>+ New apartment</button>
        </div>
      </header>

      {summaries.length === 0 ? (
        <div style={{ ...panel, ...empty }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>No designs yet</div>
          <div style={{ color: T.inkSoft, fontSize: 13 }}>Create one — it autosaves as “Untitled room”.</div>
        </div>
      ) : (
        <div style={grid}>
          {summaries.map((s) => (
            <button key={s.design_id} style={card} onClick={() => void open(s.design_id)}>
              <div style={thumbWrap}>
                {s.thumbnail ? (
                  <img src={s.thumbnail} alt="" style={thumb} />
                ) : (
                  <div style={{ ...thumb, display: 'grid', placeItems: 'center', color: T.inkFaint }}>no preview</div>
                )}
              </div>
              <div style={cardBody}>
                <div style={cardName}>{s.name}</div>
                <div style={cardMeta}>
                  {s.roomCount} room{s.roomCount === 1 ? '' : 's'} · {savedLabel(s.updatedAt)}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const shell: CSSProperties = { padding: 24, display: 'flex', flexDirection: 'column', gap: 18, height: '100%', boxSizing: 'border-box', overflow: 'auto' }
const head: CSSProperties = { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }
const title: CSSProperties = { margin: 0, fontSize: 26, fontWeight: 800, color: T.ink, letterSpacing: -0.5 }
const sub: CSSProperties = { color: T.inkSoft, fontSize: 13, marginTop: 4 }
const grid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }
const card: CSSProperties = { ...panel, padding: 0, overflow: 'hidden', textAlign: 'left', cursor: 'pointer', font: 'inherit' }
const thumbWrap: CSSProperties = { aspectRatio: '16/11', background: '#cdccc9', overflow: 'hidden' }
const thumb: CSSProperties = { width: '100%', height: '100%', objectFit: 'cover', display: 'block' }
const cardBody: CSSProperties = { padding: '10px 12px 12px' }
const cardName: CSSProperties = { fontSize: 14, fontWeight: 700, color: T.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
const cardMeta: CSSProperties = { fontSize: 12, color: T.inkSoft, marginTop: 3 }
const empty: CSSProperties = { padding: 40, display: 'grid', gap: 6, placeItems: 'center', textAlign: 'center' }
