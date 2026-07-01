// Drives Agent E's lighting store from the global `lightsOn` flag: turns the scene's electric room
// lights (task/accent layers) on/off across every room. The ambient/hemisphere fill + the sun
// (daylight) are LEFT ON, so "lights off" dims the room realistically rather than going pitch black
// (matches turning off lamps during the day). The emissive bulb GLOW is gated in MaterialEnhancer,
// so bulbs both stop lighting AND stop glowing together.
//
// Cross-island: reads Agent E's useLighting store (same singleton the app's <LightingRig> reads;
// zustand is deduped at the app root). No-op in the standalone harness (its lights aren't in E's
// store — the harness Scene reads `lightsOn` directly instead).

import { useEffect } from 'react'
import { useRender } from '../store'
import { useLighting } from '../../../lighting/src/store'

export function LightsSync() {
  const lightsOn = useRender((s) => s.lightsOn)

  useEffect(() => {
    const ls = useLighting.getState()
    // Task/accent room lights (the electric fixtures) on/off across every room.
    for (const [roomId, room] of Object.entries(ls.rooms)) {
      for (const l of room.lights) {
        if (l.layer === 'ambient') continue // keep the ambient fill so it isn't pitch black
        const currentlyOn = l.enabled !== false
        if (currentlyOn !== lightsOn) {
          ls.updateLight(roomId, l.id, { enabled: lightsOn })
        }
      }
    }
    // Also gate the sun/daylight so "off" reads as a clearly darker room (E's ceiling downlights +
    // hemisphere fill remain — they're hardcoded in E's rig — so it dims, never full black). The IBL
    // is separately dimmed in IBL.tsx. Restores on "on".
    if (ls.sun.enabled !== lightsOn) ls.setSunEnabled(lightsOn)
  }, [lightsOn])

  return null
}
