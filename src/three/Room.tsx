import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useStore } from '../store'
import { bbox } from '../geometry/walls'
import { makeFrame } from './coords'
import { getFloorTexture } from './textures'
import type { Wall } from '../types'

function FloorMesh() {
  const corners = useStore((s) => s.design.corners)
  const floorId = useStore((s) => s.design.materials.floorTexture)

  const geom = useMemo(() => {
    const frame = makeFrame(corners)
    const pts = corners.map((c) => {
      const [x, z] = frame.toWorld(c.x, c.z)
      return new THREE.Vector2(x, z)
    })
    const tris = THREE.ShapeUtils.triangulateShape(pts, [])
    const positions: number[] = []
    const uvs: number[] = []
    const normals: number[] = []
    const { texture, areaCm } = getFloorTexture(floorId)
    const repeat = areaCm / 100 // meters per texture tile
    for (const tri of tris) {
      for (const idx of tri) {
        const v = pts[idx]
        positions.push(v.x, 0, v.y)
        uvs.push(v.x / repeat, v.y / repeat)
        normals.push(0, 1, 0)
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
    return { g, texture }
  }, [corners, floorId])

  return (
    <mesh geometry={geom.g} receiveShadow position={[0, 0, 0]}>
      <meshStandardMaterial
        map={geom.texture}
        roughness={0.82}
        metalness={0}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

function WallsMesh() {
  const corners = useStore((s) => s.design.corners)
  const walls = useStore((s) => s.walls)
  const height = useStore((s) => s.design.wallHeight)
  const thickness = useStore((s) => s.design.wallThickness)
  const wallColor = useStore((s) => s.design.materials.wallColor)

  const frame = useMemo(() => makeFrame(corners), [corners])
  const groupRef = useRef<THREE.Group>(null)

  // Hide walls whose interior face points away from the camera (open-dollhouse).
  useFrame((state) => {
    const g = groupRef.current
    if (!g) return
    const cam = state.camera
    // horizontal view direction (into scene)
    const vx = state.camera.position.x
    const vz = state.camera.position.z
    g.children.forEach((child, i) => {
      const w = walls[i]
      if (!w) return
      const [mx, mz] = frame.toWorld(w.midX, w.midZ)
      // vector from wall to camera
      const toCamX = vx - mx
      const toCamZ = vz - mz
      // keep wall if its interior face (inward normal) points toward camera
      const dot = w.nx * toCamX + w.nz * toCamZ
      child.visible = dot > -0.05
    })
  })

  const hM = height / 100
  const tM = thickness / 100

  return (
    <group ref={groupRef}>
      {walls.map((w: Wall) => {
        const [mx, mz] = frame.toWorld(w.midX, w.midZ)
        const lenM = w.length / 100 + tM
        const angleY = Math.atan2(-w.dirZ, w.dirX)
        return (
          <mesh key={w.id} position={[mx, hM / 2, mz]} rotation={[0, angleY, 0]} castShadow receiveShadow>
            <boxGeometry args={[lenM, hM, tM]} />
            <meshStandardMaterial color={wallColor} roughness={0.95} metalness={0} />
          </mesh>
        )
      })}
    </group>
  )
}

export function Room() {
  return (
    <group>
      <FloorMesh />
      <WallsMesh />
    </group>
  )
}

export { bbox }
