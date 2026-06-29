import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Html } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useStore } from '../store'
import { makeFrame } from './coords'
import { pointOnWall } from '../geometry/walls'
import { formatLenShort } from '../units'
import type { Wall } from '../types'

const FLOOR_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

/** Raycast a pointer event to the floor plane (y=0). Returns world point (m). */
function useFloorRay() {
  const { camera, gl } = useThree()
  const ray = useMemo(() => new THREE.Raycaster(), [])
  const ndc = useMemo(() => new THREE.Vector2(), [])
  return (clientX: number, clientY: number): THREE.Vector3 | null => {
    const rect = gl.domElement.getBoundingClientRect()
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1
    ray.setFromCamera(ndc, camera)
    const hit = new THREE.Vector3()
    return ray.ray.intersectPlane(FLOOR_PLANE, hit) ? hit : null
  }
}

function WallHandle({ wall }: { wall: Wall }) {
  const corners = useStore((s) => s.design.corners)
  const dragWallPerp = useStore((s) => s.dragWallPerp)
  const frame = useMemo(() => makeFrame(corners), [corners])
  const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | undefined
  const floorRay = useFloorRay()
  const [hover, setHover] = useState(false)
  const drag = useRef<{ start: THREE.Vector3; prev: number } | null>(null)

  // handle bar sits along the wall, inset slightly toward the interior
  const inset = 0.12
  const [hx, hz] = frame.toWorld(wall.midX, wall.midZ)
  const px = hx + wall.nx * inset
  const pz = hz + wall.nz * inset
  const angleY = Math.atan2(-wall.dirZ, wall.dirX)
  const lenM = wall.length / 100

  const onDown = (e: any) => {
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    const hit = floorRay(e.clientX, e.clientY)
    if (!hit) return
    drag.current = { start: hit.clone(), prev: 0 }
    if (controls) controls.enabled = false
  }
  const onMove = (e: any) => {
    if (!drag.current) return
    e.stopPropagation()
    const hit = floorRay(e.clientX, e.clientY)
    if (!hit) return
    const dx = hit.x - drag.current.start.x
    const dz = hit.z - drag.current.start.z
    const along = (dx * wall.nx + dz * wall.nz) * 100 // cm
    dragWallPerp(wall.id, along - drag.current.prev)
    drag.current.prev = along
  }
  const onUp = (e: any) => {
    drag.current = null
    if (controls) controls.enabled = true
    ;(e.target as Element).releasePointerCapture?.(e.pointerId)
  }

  return (
    <group position={[px, 0.06, pz]} rotation={[0, angleY, 0]}>
      <mesh
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
      >
        <boxGeometry args={[Math.max(lenM - 0.16, 0.1), 0.07, 0.1]} />
        <meshStandardMaterial
          color={hover ? '#f3b700' : '#2a7de1'}
          transparent
          opacity={hover ? 0.98 : 0.6}
          roughness={0.35}
          emissive={hover ? '#f3b700' : '#000000'}
          emissiveIntensity={hover ? 0.25 : 0}
        />
      </mesh>
    </group>
  )
}

function DimLabel({ wall }: { wall: Wall }) {
  const corners = useStore((s) => s.design.corners)
  const unit = useStore((s) => s.design.unit)
  const frame = useMemo(() => makeFrame(corners), [corners])
  const mid = pointOnWall(wall, 0.5)
  // push label outward from the room for legibility
  const [lx, lz] = frame.toWorld(mid.x - wall.nx * 22, mid.z - wall.nz * 22)
  return (
    <Html position={[lx, 0.05, lz]} center distanceFactor={9} zIndexRange={[20, 0]}>
      <div className="dim-label">{formatLenShort(wall.length, unit)}</div>
    </Html>
  )
}

export function EditHandles() {
  const walls = useStore((s) => s.walls)
  return (
    <group>
      {walls.map((w) => (
        <WallHandle key={w.id} wall={w} />
      ))}
      {walls.map((w) => (
        <DimLabel key={`l-${w.id}`} wall={w} />
      ))}
    </group>
  )
}
