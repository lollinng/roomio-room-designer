// Runtime PBR material enhancer — a drop-in that upgrades the LOOK of existing
// MeshStandardMaterials WITHOUT editing A's source (Furniture3D/Room author them already).
//
// Two cheap, recompile-free uniform tweaks (no material.needsUpdate, no shader rebuild):
//   1) envMapIntensity — scene.environment (IBL) auto-applies as the envMap to every standard
//      material; we only scale how strongly each receives it (per-material, default 1.0; the
//      global dial is scene.environmentIntensity in IBL.tsx).
//   2) emissiveIntensity boost — A authors lamp shades (~0.45) and TV screens (~0.35) with a low
//      emissive glow. Bloom is SELECTIVE by HDR luminance (threshold ~1.0 in the HalfFloat buffer),
//      so we lift authored emissive ABOVE 1.0 (×EMISSIVE_BOOST), proportional to A's value (lamp
//      ends up brighter than the TV), making bulbs/screens actually glow. Idempotent via userData
//      (original value stashed once, always recomputed from it).
//
// Re-runs on a light throttle so furniture added/edited at runtime (A's editor) gets upgraded too.
// Skips non-standard materials (E's meshBasic sun gizmo / ceiling discs are left untouched).

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useRender } from '../store'

const EMISSIVE_BOOST = 8

interface RoomioMatData {
  __roomioBaseEmissive?: number
}

function enhanceScene(scene: THREE.Object3D, envMapIntensity: number, lightsOn: boolean) {
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
    if (!mat) return
    const mats = Array.isArray(mat) ? mat : [mat]
    for (const m of mats) {
      const sm = m as THREE.MeshStandardMaterial
      if (!sm.isMeshStandardMaterial) continue

      // (1) scale IBL contribution (uniform set — no recompile)
      sm.envMapIntensity = envMapIntensity

      // (2) lift authored emissive into the HDR bloom range, proportional to its authored value,
      //     and GATE it on lightsOn so bulbs stop glowing when the scene lights go off. Detection
      //     keys on the cached base (once seen) so a zeroed-emissive bulb can be restored.
      const ud = sm.userData as RoomioMatData
      const isBulb =
        ud.__roomioBaseEmissive !== undefined ||
        (!!sm.emissive && sm.emissive.r + sm.emissive.g + sm.emissive.b > 0.01 && sm.emissiveIntensity > 0)
      if (isBulb) {
        if (ud.__roomioBaseEmissive === undefined) ud.__roomioBaseEmissive = sm.emissiveIntensity
        sm.emissiveIntensity = lightsOn ? ud.__roomioBaseEmissive * EMISSIVE_BOOST : 0
      }
    }
  })
}

export function MaterialEnhancer() {
  const scene = useThree((s) => s.scene)
  const envMapIntensity = useRender((s) => s.settings.materials.envMapIntensity)
  const lightsOn = useRender((s) => s.lightsOn)
  const frame = useRef(0)

  // Immediate apply on mount + whenever the intensity dial or lights toggle changes.
  useEffect(() => {
    enhanceScene(scene, envMapIntensity, lightsOn)
  }, [scene, envMapIntensity, lightsOn])

  // Catch dynamically added/edited furniture without per-frame cost.
  useFrame(() => {
    frame.current += 1
    if (frame.current % 24 === 0) enhanceScene(scene, envMapIntensity, lightsOn)
  })

  return null
}
