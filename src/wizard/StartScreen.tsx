import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { useAuth } from '../auth'
import { importDesignJSON, type DesignSummary } from '../persistence'
import { listDesigns, loadDesign as repoLoad, deleteDesign as repoDelete } from '../repository'
import { StyleStart } from './StyleStart'

const SHAPE_LABELS: Record<string, string> = {
  rect: 'Rectangle',
  l: 'L-shape',
  t: 'T-shape',
  u: 'U-shape',
  cut: 'Cut corner',
  beveled: 'Beveled',
}

const shapeLabel = (shape: string): string => SHAPE_LABELS[shape] ?? shape

function formatUpdated(ts: number): string {
  const d = new Date(ts)
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

export function StartScreen() {
  const resetDesign = useStore((s) => s.resetDesign)
  const loadDesignIntoStore = useStore((s) => s.loadDesign)

  const authStatus = useAuth((s) => s.status)
  const user = useAuth((s) => s.user)
  const logout = useAuth((s) => s.logout)

  const [designs, setDesigns] = useState<DesignSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [showStyles, setShowStyles] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  async function refresh() {
    setLoading(true)
    try {
      setDesigns(await listDesigns())
    } catch {
      setDesigns([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus])

  async function handleOpen(id: string) {
    const d = await repoLoad(id)
    if (d) loadDesignIntoStore(d)
  }

  async function handleDelete(id: string) {
    await repoDelete(id)
    refresh()
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const text = typeof reader.result === 'string' ? reader.result : ''
        const d = importDesignJSON(text)
        if (d) loadDesignIntoStore(d)
      } catch {
        /* ignore malformed file */
      }
    }
    try {
      reader.readAsText(file)
    } catch {
      /* ignore */
    }
  }

  const cloud = authStatus === 'authed'

  if (showStyles) return <StyleStart onClose={() => setShowStyles(false)} />

  return (
    <div className="start">
      <div className="start-card" style={{ width: 560, maxWidth: '92vw' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="brand" style={{ marginBottom: 0 }}>
            <span className="dot" />
            Roomio
          </div>
          {cloud ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>
                {user?.name || user?.email}
              </span>
              <button className="btn btn-ghost btn-sm" style={{ flex: 'none' }} onClick={logout}>
                Log out
              </button>
            </div>
          ) : (
            <span className="guest-pill">Guest · saved to this browser</span>
          )}
        </div>

        <h1 className="start-title" style={{ marginTop: 26 }}>
          Design your room
        </h1>
        <p className="start-sub">
          Pick a shape, set the dimensions, add doors &amp; windows, choose your style — then
          furnish it. Or start from a persona room that’s already furnished for you.
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary"
            style={{ flex: '1 1 200px' }}
            onClick={() => setShowStyles(true)}
          >
            ✨ Start from a style that’s you
          </button>
          <button
            className="btn btn-ghost"
            style={{ flex: '1 1 160px' }}
            onClick={() => resetDesign('rect')}
          >
            Start a blank room
          </button>
          <button
            className="btn btn-ghost btn-sm"
            style={{ flex: 'none' }}
            onClick={() => fileInputRef.current?.click()}
          >
            Import JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
        </div>

        <div style={{ marginTop: 32 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 14 }}>
            {cloud ? 'Your saved rooms' : 'Saved rooms (this browser)'}
          </div>

          {loading ? (
            <p style={{ fontSize: 13.5, color: 'var(--ink-3)', margin: 0 }}>Loading…</p>
          ) : designs.length === 0 ? (
            <p style={{ fontSize: 13.5, color: 'var(--ink-3)', margin: 0, lineHeight: 1.5 }}>
              No saved rooms yet — start one above.
            </p>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                maxHeight: 260,
                overflowY: 'auto',
                paddingRight: 4,
                marginRight: -4,
              }}
            >
              {designs.map((d) => (
                <div
                  key={d.id}
                  onClick={() => handleOpen(d.id)}
                  className="saved-row"
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14.5,
                        fontWeight: 700,
                        color: 'var(--ink)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {d.name}
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 4 }}>
                      {shapeLabel(d.shape)} · Updated {formatUpdated(d.updatedAt)}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(d.id)
                    }}
                    className="saved-del"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
