/**
 * HouseView (Agent E, multi-room) — renders ALL session rooms together as one
 * interconnected floor plan (read-only overview), instead of editing one room at
 * a time. Each room is placed at its house-plane position (houseLayout) with a
 * doorway cut to its neighbour, so you see the whole house with rooms connected.
 *
 * Reuses Agent A's PURE geometry (makeFrame / deriveWalls / buildWallParts /
 * pointOnWall) and renderers (getFloorTexture, FurnitureModel) read-only — A's
 * Room.tsx is untouched. The house is centred at the world origin so the sun's
 * shadow frustum and the camera framing stay simple.
 */
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { ContactShadows } from '@react-three/drei'
import { makeFrame, type Frame } from './coords'
import { deriveWalls, buildWallParts, pointOnWall } from '../geometry/walls'
import { getFloorTexture } from './textures'
import { ARCHETYPE_MAP } from '../data/archetypes'
import { elevationCm } from './mount'
import { FurnitureModel } from './Furniture3D'
import { Sun } from '../../lighting/src/r3f/Sun'
import type { PlacedRoom } from './houseLayout'
import type { RoomDesign, Vec2 } from '../types'

interface Bounds {
  w: number
  d: number
  cx: number
  cz: number
}

function RoomFloor({ corners, floorTexture, frame }: { corners: Vec2[]; floorTexture: string; frame: Frame }) {
  const geom = useMemo(() => {
    const pts = corners.map((c) => {
      const [x, z] = frame.toWorld(c.x, c.z)
      return new THREE.Vector2(x, z)
    })
    const tris = THREE.ShapeUtils.triangulateShape(pts, [])
    const positions: number[] = []
    const uvs: number[] = []
    const normals: number[] = []
    const { texture, areaCm } = getFloorTexture(floorTexture)
    const repeat = areaCm / 100
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
  }, [corners, floorTexture, frame])

  return (
    <mesh geometry={geom.g} receiveShadow>
      <meshStandardMaterial map={geom.texture} roughness={0.82} metalness={0} side={THREE.DoubleSide} />
    </mesh>
  )
}

function RoomFurniture({ design, frame }: { design: RoomDesign; frame: Frame }) {
  return (
    <>
      {design.furniture.map((item) => {
        const arch = ARCHETYPE_MAP[item.archetype]
        if (!arch) return null
        const [wx, wz] = frame.toWorld(item.x, item.z)
        const elevM = elevationCm(item, design.furniture) / 100
        return (
          <group key={item.id} position={[wx, elevM, wz]} rotation={[0, item.rotation, 0]}>
            <FurnitureModel model={arch.model} w={item.w} d={item.d} h={item.h} color={item.color} />
          </group>
        )
      })}
    </>
  )
}

/** One placed room: floor + walls (doorways cut) + static furniture, offset to its
 *  house position (relative to the house centre at the world origin). */
function RoomShell({ placed, originCm }: { placed: PlacedRoom; originCm: { x: number; z: number } }) {
  const { design, centerCm, extraOpenings } = placed
  const frame = useMemo(() => makeFrame(design.corners), [design.corners])
  const walls = useMemo(() => deriveWalls(design.corners), [design.corners])
  const openings = useMemo(() => [...design.openings, ...extraOpenings], [design.openings, extraOpenings])

  const offX = (centerCm.x - originCm.x) / 100
  const offZ = (centerCm.z - originCm.z) / 100
  const wallGroupRefs = useRef<(THREE.Group | null)[]>([])

  // Dollhouse cull across the whole house: hide a wall when its interior face points
  // away from the camera, so you can see into every room from above.
  useFrame((state) => {
    const camX = state.camera.position.x
    const camZ = state.camera.position.z
    walls.forEach((w, i) => {
      const g = wallGroupRefs.current[i]
      if (!g) return
      const [mxW, mzW] = frame.toWorld(w.midX, w.midZ)
      const wx = offX + mxW
      const wz = offZ + mzW
      const dot = w.nx * (camX - wx) + w.nz * (camZ - wz)
      g.visible = dot > -0.05
    })
  })

  return (
    <group position={[offX, 0, offZ]}>
      <RoomFloor corners={design.corners} floorTexture={design.materials.floorTexture} frame={frame} />
      {walls.map((w, i) => {
        const parts = buildWallParts(
          w,
          openings.filter((o) => o.wallId === w.id),
          design.wallHeight,
          design.wallThickness,
        )
        const angleY = Math.atan2(-w.dirZ, w.dirX)
        return (
          <group key={w.id} ref={(el) => (wallGroupRefs.current[i] = el)}>
            {parts.map((p, j) => {
              const base = pointOnWall(w, p.uCenter / w.length)
              const [x, z] = frame.toWorld(base.x, base.z)
              return (
                <mesh key={j} position={[x, p.vCenter / 100, z]} rotation={[0, angleY, 0]} castShadow receiveShadow>
                  <boxGeometry args={[p.lenU / 100, p.lenV / 100, design.wallThickness / 100]} />
                  <meshStandardMaterial color={design.materials.wallColor} roughness={0.95} metalness={0} />
                </mesh>
              )
            })}
          </group>
        )
      })}
      <RoomFurniture design={design} frame={frame} />
    </group>
  )
}

/** Frame the camera on the whole-house bounding box when it changes. */
function HouseCameraFit({ bounds }: { bounds: Bounds }) {
  const { camera, controls } = useThree()
  const key = `${Math.round(bounds.w)}x${Math.round(bounds.d)}`
  useMemo(() => {
    const r = Math.max(bounds.w, bounds.d, 300) / 100
    const dist = r * 1.25
    camera.position.set(dist * 0.5, dist * 0.95, dist * 0.65)
    camera.updateProjectionMatrix()
    const c = controls as unknown as { target?: { set: (x: number, y: number, z: number) => void }; update?: () => void } | null
    if (c?.target) {
      c.target.set(0, 0.4, 0)
      c.update?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return null
}

export function HouseView({ placed, bounds }: { placed: PlacedRoom[]; bounds: Bounds }) {
  const houseHalfExtentM = Math.max(bounds.w, bounds.d, 300) / 100 / 2
  const originCm = { x: bounds.cx, z: bounds.cz }
  const shadowScale = (Math.max(bounds.w, bounds.d, 300) / 100) * 1.4

  return (
    <>
      {/* Even, global lighting for the overview (per-room task lights would be at the
          wrong place once rooms are spread out). The sun adds soft directional shadows. */}
      <hemisphereLight color="#ffffff" groundColor="#cfcbc2" intensity={0.9} />
      <ambientLight intensity={0.42} />
      <Sun houseHalfExtentM={houseHalfExtentM} />

      {placed.map((p, i) => (
        <RoomShell key={`${p.design.id}_${i}`} placed={p} originCm={originCm} />
      ))}

      <ContactShadows position={[0, 0.002, 0]} scale={shadowScale} resolution={1024} blur={2.6} opacity={0.34} far={6} />
      <HouseCameraFit bounds={bounds} />
    </>
  )
}
