import { DOOR_DEFS, WINDOW_DEFS } from '../data/openings'

// Panel UI is wired in the M2 cycle; placement overlay lives in the viewport.
export function Step3Openings() {
  return (
    <div>
      <div className="section-label">Door styles</div>
      <div className="opening-grid">
        {DOOR_DEFS.map((d) => (
          <div key={d.style} className="opening-card">
            <div className="opening-thumb" />
            <span>{d.name}</span>
          </div>
        ))}
      </div>
      <div className="section-label">Window styles</div>
      <div className="opening-grid">
        {WINDOW_DEFS.map((d) => (
          <div key={d.style} className="opening-card">
            <div className="opening-thumb" />
            <span>{d.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
