// LightingRig — the single drop-in that replaces A's local <Lights> inside the <Canvas>.
// Renders: ONE global ambient fill (hemisphere + low ambient) so nothing is pitch black
// and shadows aren't pure black; per-room task/accent lights; and the sun.
//
// Ambient is intentionally GLOBAL (not stacked per-room) so a multi-room house doesn't
// over-brighten or pay for N hemisphere lights. Per-room ambient entries still exist in
// the state (for editability + A's layered-lighting predicate); the rig uses a
// representative one for the scene fill.

import { useLighting } from '../store'
import { Sun } from './Sun'
import { RoomLights } from './RoomLights'

export interface LightingRigProps {
  /** half-extent of the whole house in meters (for the sun's shadow frustum). */
  houseHalfExtentM: number
  /** renderer-tuned base sun intensity at noon (legacy units). */
  baseIntensity?: number
}

export function LightingRig({ houseHalfExtentM, baseIntensity }: LightingRigProps) {
  const rooms = useLighting((s) => s.rooms)

  const ambientLights = Object.values(rooms)
    .flatMap((r) => r.lights)
    .filter((l) => l.layer === 'ambient' && l.enabled !== false && l.intensity > 0)

  const fill = ambientLights[0]
  const skyColor = fill?.color ?? '#ffffff'
  const groundColor = fill?.groundColor ?? '#cfcbc2'
  const hemiIntensity = fill?.intensity ?? 0.7

  return (
    <>
      {/* Global ambient fill so no surface is pure black (pairs with the sun's shadows). */}
      <hemisphereLight color={skyColor} groundColor={groundColor} intensity={hemiIntensity} />
      <ambientLight intensity={0.22} />

      {/* Per-room task/accent lights. */}
      {Object.entries(rooms).map(([id, r]) => (
        <RoomLights key={id} lights={r.lights} />
      ))}

      {/* The sun. */}
      <Sun houseHalfExtentM={houseHalfExtentM} baseIntensity={baseIntensity} />
    </>
  )
}
