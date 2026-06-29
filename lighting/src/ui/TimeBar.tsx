// Time-of-day bar (Pillar 3). Scrubbing arcs the sun + sweeps shadows + shifts warmth.
// Toggles independently of the north indicator. DOM overlay (rendered outside the Canvas).

import { useLighting } from '../store'

function timeLabel(t: number): string {
  // 0 -> 06:00 (dawn), 0.5 -> 12:00 (noon), 1 -> 18:00 (dusk)
  const hours = 6 + t * 12
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function TimeBar() {
  const timeOfDay = useLighting((s) => s.timeOfDay)
  const setTimeOfDay = useLighting((s) => s.setTimeOfDay)
  const sun = useLighting((s) => s.sun)
  const setSunEnabled = useLighting((s) => s.setSunEnabled)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px',
        borderRadius: 12,
        background: 'rgba(20,22,26,0.78)',
        color: '#f4f1ea',
        backdropFilter: 'blur(6px)',
        font: '13px ui-sans-serif, system-ui, sans-serif',
        minWidth: 360,
      }}
    >
      <span style={{ fontWeight: 600 }}>🕑 {timeLabel(timeOfDay)}</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.001}
        value={timeOfDay}
        onChange={(e) => setTimeOfDay(parseFloat(e.target.value))}
        style={{ flex: 1, accentColor: '#ffb454' }}
        aria-label="Time of day"
      />
      <span style={{ opacity: 0.6, width: 44 }}>
        {timeOfDay < 0.12 ? 'dawn' : timeOfDay > 0.88 ? 'dusk' : timeOfDay > 0.42 && timeOfDay < 0.58 ? 'noon' : ''}
      </span>
      <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
        <input type="checkbox" checked={sun.enabled} onChange={(e) => setSunEnabled(e.target.checked)} />
        sun
      </label>
    </div>
  )
}
