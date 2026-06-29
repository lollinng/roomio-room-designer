import { useState } from 'react'
import { useStore } from '../store'
import { formatLenShort, parseLen, formatLen } from '../units'
import { bbox } from '../geometry/walls'

function LengthInput({
  cm,
  onCommit,
}: {
  cm: number
  onCommit: (cm: number) => void
}) {
  const unit = useStore((s) => s.design.unit)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')

  const display = formatLenShort(cm, unit)
  const commit = () => {
    const parsed = parseLen(text, unit)
    if (parsed != null) onCommit(parsed)
    setEditing(false)
  }
  return (
    <input
      className="len-input"
      value={editing ? text : display}
      onFocus={() => {
        setEditing(true)
        setText(display)
      }}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') setEditing(false)
      }}
    />
  )
}

export function Step2Dimensions() {
  const unit = useStore((s) => s.design.unit)
  const setUnit = useStore((s) => s.setUnit)
  const walls = useStore((s) => s.walls)
  const setWallLength = useStore((s) => s.setWallLength)
  const wallHeight = useStore((s) => s.design.wallHeight)
  const setWallHeight = useStore((s) => s.setWallHeight)
  const corners = useStore((s) => s.design.corners)
  const b = bbox(corners)

  return (
    <div>
      <div className="overall-size">
        <span>Overall</span>
        <strong>
          {formatLen(b.w, unit)} <span className="x">×</span> {formatLen(b.d, unit)}
        </strong>
      </div>
      <div className="segmented">
        <button className={unit === 'ft' ? 'active' : ''} onClick={() => setUnit('ft')}>
          Feet
        </button>
        <button className={unit === 'cm' ? 'active' : ''} onClick={() => setUnit('cm')}>
          Centimetres
        </button>
      </div>

      <div className="section-label">
        Wall lengths<span className="sub">{walls.length} walls</span>
      </div>
      <div className="wall-list">
        {walls.map((w, i) => (
          <div className="wall-row" key={w.id}>
            <span className="wall-dot" style={{ background: `hsl(${(i * 47) % 360} 55% 55%)` }} />
            <span className="wall-name">Wall {i + 1}</span>
            <LengthInput cm={w.length} onCommit={(cm) => setWallLength(w.id, cm)} />
          </div>
        ))}
      </div>

      <hr className="divider" />
      <div className="section-label">Wall height</div>
      <div className="wall-row">
        <input
          type="range"
          min={200}
          max={360}
          value={wallHeight}
          onChange={(e) => setWallHeight(Number(e.target.value))}
          style={{ flex: 1 }}
        />
        <span className="wall-name" style={{ minWidth: 70, textAlign: 'right' }}>
          {formatLenShort(wallHeight, unit)}
        </span>
      </div>
      <p className="hint">Drag a wall in the 3D view, or type an exact length above.</p>
    </div>
  )
}
