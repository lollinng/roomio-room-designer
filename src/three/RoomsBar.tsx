/**
 * Rooms bar (Agent C, multi-room) — the in-app UI to ADD ROOMS and switch between
 * them, shown at the top of the Furnish panel. Reuses /multi-room's room types.
 * Self-contained; drives the additive house session (houseSession.ts).
 */
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { useStore } from '../store'
import { useHouse, ROOM_TYPE_LIST, ROOM_TYPE_INFO } from './houseSession'

export function RoomsBar() {
  const rooms = useHouse((s) => s.rooms)
  const activeId = useHouse((s) => s.activeId)
  const ensureInit = useHouse((s) => s.ensureInit)
  const addRoom = useHouse((s) => s.addRoom)
  const switchRoom = useHouse((s) => s.switchRoom)
  const removeRoom = useHouse((s) => s.removeRoom)
  // live name of the active room (the editor owns the active design)
  const activeName = useStore((s) => s.design.name)
  const [adding, setAdding] = useState(false)

  // Seed the house from the current room the first time the furnish view shows.
  useEffect(() => {
    ensureInit()
  }, [ensureInit])

  const list = rooms.length ? rooms : []

  return (
    <div style={wrap}>
      <div className="section-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>Rooms{list.length > 1 ? ` · ${list.length}` : ''}</span>
      </div>

      <div style={chipRow}>
        {list.map((r) => {
          const active = r.id === activeId
          const name = active ? activeName : r.design.name
          const typeLabel = ROOM_TYPE_INFO[r.type].label
          // Show the type as a muted prefix only when it adds information.
          const showType = name.trim().toLowerCase() !== typeLabel.toLowerCase()
          return (
            <span key={r.id} style={{ ...chip, ...(active ? chipActive : null) }} data-testid="room-chip">
              <button
                onClick={() => switchRoom(r.id)}
                title={`${typeLabel} — switch to this room`}
                style={chipBtn(active)}
              >
                {showType && <span style={{ opacity: 0.7, marginRight: 5 }}>{typeLabel}</span>}
                {name}
              </button>
              {list.length > 1 && (
                <button
                  onClick={() => {
                    if (confirm(`Remove “${name}”? This room's furniture will be discarded.`)) removeRoom(r.id)
                  }}
                  title="Remove room"
                  style={chipX(active)}
                >
                  ×
                </button>
              )}
            </span>
          )
        })}

        <button
          className="btn btn-ghost btn-sm"
          style={{ flex: 'none' }}
          onClick={() => setAdding((v) => !v)}
          data-testid="add-room"
        >
          ＋ Add room
        </button>
      </div>

      {adding && (
        <div style={picker} data-testid="room-type-picker">
          <div className="section-label" style={{ margin: '2px 0 6px' }}>Add a…</div>
          <div style={pickerGrid}>
            {ROOM_TYPE_LIST.map((info) => (
              <button
                key={info.type}
                className="btn btn-ghost btn-sm"
                style={{ justifyContent: 'flex-start' }}
                onClick={() => {
                  addRoom(info.type)
                  setAdding(false)
                }}
                title={info.purpose}
              >
                {info.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const wrap: CSSProperties = {
  marginBottom: 18,
  paddingBottom: 16,
  borderBottom: '1.5px solid #e6e3dd',
}
const chipRow: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }
const chip: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  border: '1.5px solid #d9d5cd',
  borderRadius: 999,
  overflow: 'hidden',
  background: '#fff',
}
const chipActive: CSSProperties = { borderColor: '#111', background: '#111' }
const chipBtn = (active: boolean): CSSProperties => ({
  border: 'none',
  background: 'transparent',
  color: active ? '#fff' : 'var(--ink-1, #23211e)',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  padding: '6px 12px',
})
const chipX = (active: boolean): CSSProperties => ({
  border: 'none',
  background: 'transparent',
  color: active ? '#fff' : '#b0392f',
  fontSize: 15,
  fontWeight: 700,
  cursor: 'pointer',
  padding: '4px 8px 4px 0',
})
const picker: CSSProperties = {
  marginTop: 10,
  padding: 12,
  borderRadius: 12,
  border: '1.5px solid #e6e3dd',
  background: '#fbfaf7',
}
const pickerGrid: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }
