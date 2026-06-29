import { ARCHETYPES, CATEGORY_ORDER } from '../data/archetypes'

// Full furnish stage (catalog drag-in + transform gizmos) is built in the M3 cycle.
export function Furnish() {
  return (
    <div>
      {CATEGORY_ORDER.map((cat) => {
        const items = ARCHETYPES.filter((a) => a.category === cat.id)
        if (!items.length) return null
        return (
          <div key={cat.id}>
            <div className="section-label">{cat.label}</div>
            <div className="catalog-grid">
              {items.map((a) => (
                <div key={a.id} className="catalog-card">
                  <span className="catalog-icon">{a.icon}</span>
                  <span>{a.name}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
