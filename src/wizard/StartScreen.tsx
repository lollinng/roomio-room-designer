import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import {
  listDesigns,
  loadDesign as loadStored,
  deleteDesign,
  importDesignJSON,
  type DesignSummary,
} from '../persistence'

const SHAPE_LABELS: Record<string, string> = {
  rect: 'Rectangle',
  l: 'L-shape',
  t: 'T-shape',
  u: 'U-shape',
  cut: 'Cut corner',
  beveled: 'Beveled',
}

function shapeLabel(shape: string): string {
  return SHAPE_LABELS[shape] ?? shape
}

function formatUpdated(ts: number): string {
  const d = new Date(ts)
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`
}

export function StartScreen() {
  const resetDesign = useStore((s) => s.resetDesign)
  const loadDesignIntoStore = useStore((s) => s.loadDesign)

  const [designs, setDesigns] = useState<DesignSummary[]>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  function refresh() {
    setDesigns(listDesigns())
  }

  useEffect(() => {
    refresh()
  }, [])

  function handleOpen(id: string) {
    const d = loadStored(id)
    if (d) loadDesignIntoStore(d)
  }

  function handleDelete(id: string) {
    deleteDesign(id)
    refresh()
  }

  function handleImportClick() {
    fileInputRef.current?.click()
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // reset the input so the same file can be re-selected later
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const text = typeof reader.result === 'string' ? reader.result : ''
        const d = importDesignJSON(text)
        if (d) {
          loadDesignIntoStore(d)
        }
      } catch {
        // ignore malformed file
      }
    }
    try {
      reader.readAsText(file)
    } catch {
      // ignore unreadable file
    }
  }

  return (
    <div className="start">
      <div className="start-card" style={{ width: 560, maxWidth: '92vw' }}>
        <div className="brand">
          <span className="dot" />
          Roomio
        </div>
        <h1 className="start-title">Design your room</h1>
        <p className="start-sub">
          Pick a shape, set the dimensions, add doors &amp; windows, choose your style — then
          furnish it. A clean, accurate room you author yourself.
        </p>

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            className="btn btn-primary"
            style={{ flex: 1 }}
            onClick={() => resetDesign('rect')}
          >
            Start a new room
          </button>
          <button className="btn btn-ghost btn-sm" style={{ flex: 'none' }} onClick={handleImportClick}>
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
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--ink)',
              marginBottom: 14,
            }}
          >
            Your saved rooms
          </div>

          {designs.length === 0 ? (
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
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    background: '#fff',
                    border: '1px solid #e6e3dd',
                    borderRadius: 12,
                    padding: '14px 16px',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#b9b4a9'
                    e.currentTarget.style.background = '#fbfaf7'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e6e3dd'
                    e.currentTarget.style.background = '#fff'
                  }}
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
                    style={{
                      flex: 'none',
                      border: '1px solid #e6e3dd',
                      background: '#fff',
                      borderRadius: 999,
                      padding: '7px 14px',
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: '#b0392f',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#b0392f'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#e6e3dd'
                    }}
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
