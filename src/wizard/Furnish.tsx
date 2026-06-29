import { useStore } from '../store'
import { ARCHETYPES, ARCHETYPE_MAP, CATEGORY_ORDER } from '../data/archetypes'
import { formatLenShort } from '../units'
import type { FurnitureItem } from '../types'

// Curated furniture palette — greys, blues, greens, tans, terracotta, charcoal,
// cream, mustard, plum. The selected item's archetype default is appended too,
// so the original colour always has a swatch.
const PALETTE = [
  '#c8c4bc', // light grey
  '#8a8780', // mid grey
  '#3b3f45', // charcoal
  '#7d8a99', // slate blue
  '#4f6275', // deep blue
  '#6f7d72', // sage green
  '#3f7a4b', // forest green
  '#cdbfa6', // tan
  '#f3eddf', // cream
  '#c08a6a', // terracotta
  '#d8a93a', // mustard
  '#7a4f6b', // plum
]

function normalizeDeg(rad: number): number {
  let deg = Math.round((rad * 180) / Math.PI) % 360
  if (deg < 0) deg += 360
  return deg
}

function ItemEditor({ item }: { item: FurnitureItem }) {
  const unit = useStore((s) => s.design.unit)
  const updateFurniture = useStore((s) => s.updateFurniture)
  const removeFurniture = useStore((s) => s.removeFurniture)

  const arch = ARCHETYPE_MAP[item.archetype]
  const min = arch?.min ?? [10, 10, 10]
  const max = arch?.max ?? [400, 400, 400]
  const lockH = arch?.lockH ?? false

  // palette including the archetype default colour (deduped)
  const colors = arch && !PALETTE.includes(arch.color) ? [...PALETTE, arch.color] : PALETTE

  const rotateBy = (delta: number) =>
    updateFurniture(item.id, { rotation: item.rotation + delta })
  const snap90 = () => {
    const step = Math.PI / 2
    updateFurniture(item.id, { rotation: Math.round(item.rotation / step) * step })
  }

  const dims: { label: string; key: 'w' | 'd' | 'h'; axis: number }[] = [
    { label: 'Width', key: 'w', axis: 0 },
    { label: 'Depth', key: 'd', axis: 1 },
    { label: 'Height', key: 'h', axis: 2 },
  ]

  return (
    <div
      style={{
        background: '#fbfaf7',
        padding: '16px 18px',
        borderRadius: 14,
        border: '1.5px solid #e6e3dd',
        marginBottom: 22,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 16, fontWeight: 700 }}>{item.name}</span>
        <button
          onClick={() => removeFurniture(item.id)}
          style={{
            border: 'none',
            background: 'none',
            color: '#b0392f',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          Remove
        </button>
      </div>

      {/* ---- Rotation ---- */}
      <div className="wall-row" style={{ marginBottom: 16 }}>
        <span className="wall-name">Rotation</span>
        <button className="btn btn-ghost btn-sm" style={{ flex: 'none' }} onClick={() => rotateBy(-Math.PI / 12)}>
          ⟲ 15°
        </button>
        <button className="btn btn-ghost btn-sm" style={{ flex: 'none' }} onClick={() => rotateBy(Math.PI / 12)}>
          ⟳ 15°
        </button>
        <button className="btn btn-ghost btn-sm" style={{ flex: 'none' }} onClick={snap90}>
          90°
        </button>
        <span style={{ minWidth: 42, textAlign: 'right', fontSize: 13.5, fontWeight: 600, color: 'var(--ink-2)' }}>
          {normalizeDeg(item.rotation)}°
        </span>
      </div>

      {/* ---- Resize ---- */}
      <div className="section-label" style={{ margin: '0 0 10px' }}>
        Size
      </div>
      {dims.map(({ label, key, axis }) => {
        const disabled = key === 'h' && lockH
        return (
          <div className="wall-row" key={key} style={{ marginBottom: 10 }}>
            <span className="wall-name" style={{ flex: 'none', minWidth: 54 }}>
              {label}
            </span>
            <input
              type="range"
              min={min[axis]}
              max={max[axis]}
              step={1}
              value={item[key]}
              disabled={disabled}
              onChange={(e) => updateFurniture(item.id, { [key]: Number(e.target.value) })}
              style={{ flex: 1, opacity: disabled ? 0.4 : 1 }}
            />
            <span style={{ minWidth: 56, textAlign: 'right', fontSize: 13.5, fontWeight: 600 }}>
              {formatLenShort(item[key], unit)}
            </span>
          </div>
        )
      })}

      {/* ---- Color ---- */}
      <div className="section-label" style={{ margin: '16px 0 10px' }}>
        Colour
      </div>
      <div className="swatch-grid">
        {colors.map((c) => (
          <button
            key={c}
            title={c}
            className={`swatch${item.color === c ? ' active' : ''}`}
            style={{ background: c }}
            onClick={() => updateFurniture(item.id, { color: c })}
          />
        ))}
      </div>
    </div>
  )
}

export function Furnish() {
  const sel = useStore((s) => s.selectedFurnitureId)
  const furniture = useStore((s) => s.design.furniture)
  const addFurnitureCentered = useStore((s) => s.addFurnitureCentered)

  const selected = sel ? furniture.find((f) => f.id === sel) : undefined

  return (
    <div>
      {selected && <ItemEditor item={selected} />}

      {CATEGORY_ORDER.map((cat) => {
        const items = ARCHETYPES.filter((a) => a.category === cat.id)
        if (!items.length) return null
        return (
          <div key={cat.id}>
            <div className="section-label">{cat.label}</div>
            <div className="catalog-grid">
              {items.map((a) => (
                <button
                  key={a.id}
                  className="catalog-card"
                  onClick={() => addFurnitureCentered(a.id)}
                >
                  <span className="catalog-icon">{a.icon}</span>
                  <span>{a.name}</span>
                </button>
              ))}
            </div>
          </div>
        )
      })}

      <p className="hint">
        Click a piece to add it, then drag, rotate, resize and recolor it. Furniture snaps to walls
        and won't pass through them.
      </p>
    </div>
  )
}
