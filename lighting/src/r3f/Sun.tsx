// The sun: ONE THREE.DirectionalLight, aimed position->target(origin), driven by the
// time bar + north offset. Primary (ideally only) shadow caster. Orthographic shadow
// frustum sized to enclose the whole house, or shadows clip.

import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useLighting } from '../store'
import { sampleSun } from '../sun'

export interface SunProps {
  /** half-extent of the house in meters (max(halfWidth, halfDepth)); frustum is sized to enclose it. */
  houseHalfExtentM: number
  /** renderer-tuned base intensity at noon (legacy units; matches A's ~1.35). */
  baseIntensity?: number
  /** extra meters of margin around the house for the shadow frustum. */
  marginM?: number
}

export function Sun({ houseHalfExtentM, baseIntensity = 1.35, marginM = 3 }: SunProps) {
  const ref = useRef<THREE.DirectionalLight>(null)
  const timeOfDay = useLighting((s) => s.timeOfDay)
  const northOffsetDeg = useLighting((s) => s.northOffsetDeg)
  const sun = useLighting((s) => s.sun)
  const shadow = useLighting((s) => s.shadow)

  const half = (shadow.halfExtentM ?? houseHalfExtentM) + marginM
  // far must enclose the sun (on the dome) -> house, plus the frustum depth.
  const far = sun.domeRadiusM + half * 2 + 5

  const sample = useMemo(
    () =>
      sampleSun(timeOfDay, {
        maxElevationDeg: sun.maxElevationDeg,
        northOffsetDeg,
        domeRadiusM: sun.domeRadiusM,
        warmthShift: sun.warmthShift,
      }),
    [timeOfDay, northOffsetDeg, sun.maxElevationDeg, sun.domeRadiusM, sun.warmthShift],
  )

  // The orthographic shadow camera needs an explicit projection update when bounds change.
  useEffect(() => {
    const light = ref.current
    if (!light) return
    const cam = light.shadow.camera as THREE.OrthographicCamera
    cam.left = -half
    cam.right = half
    cam.top = half
    cam.bottom = -half
    cam.near = 0.5
    cam.far = far
    cam.updateProjectionMatrix()
    light.shadow.bias = shadow.bias
    light.shadow.normalBias = shadow.normalBias
    light.shadow.needsUpdate = true
  }, [half, far, shadow.bias, shadow.normalBias])

  if (!sun.enabled || sample.belowHorizon) return null

  const intensity = baseIntensity * sample.intensityFactor * sun.intensityScale

  return (
    <directionalLight
      ref={ref}
      position={sample.position}
      intensity={intensity}
      color={sample.color}
      castShadow
      shadow-mapSize-width={shadow.mapSize}
      shadow-mapSize-height={shadow.mapSize}
    />
  )
}
