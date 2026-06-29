import { useStore } from '../store'

export function StartScreen() {
  const resetDesign = useStore((s) => s.resetDesign)
  return (
    <div className="start">
      <div className="start-card">
        <div className="brand">
          <span className="dot" />
          Roomio
        </div>
        <h1 className="start-title">Design your room</h1>
        <p className="start-sub">
          Pick a shape, set the dimensions, add doors &amp; windows, choose your style — then
          furnish it. A clean, accurate room you author yourself.
        </p>
        <button className="btn btn-primary" style={{ flex: 'none', width: '100%' }} onClick={() => resetDesign('rect')}>
          Start a new room
        </button>
      </div>
    </div>
  )
}
