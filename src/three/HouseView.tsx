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
import { useMemo, useRef, useState, type CSSProperties } from 'react'
import * as THREE from 'three'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useHouse } from './houseSession'
import { useStore } from '../store'
import { ContactShadows, Html } from '@react-three/drei'
import { makeFrame, type Frame } from './coords'
import { deriveWalls, buildWallParts, pointOnWall, bbox } from '../geometry/walls'
import { parseLen, formatLenShort, type Unit } from '../units'
import { getFloorTexture } from './textures'
import { ARCHETYPE_MAP } from '../data/archetypes'
import { elevationCm } from './mount'
import { FurnitureModel } from './Furniture3D'
import { Sun } from '../../lighting/src/r3f/Sun'
import { useLighting } from '../../lighting/src/store'
import type { PlacedRoom } from './houseLayout'
import type { RoomDesign, Vec2 } from '../types'

interface Bounds {
  w: number
  d: number
  cx: number
  cz: number
}

function RoomFloor({
  corners,
  floorTexture,
  frame,
  onPointerDown,
  onPointerUp,
}: {
  corners: Vec2[]
  floorTexture: string
  frame: Frame
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void
  onPointerUp?: (e: ThreeEvent<PointerEvent>) => void
}) {
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
    <mesh geometry={geom.g} receiveShadow onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
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
function RoomShell({
  placed,
  originCm,
  onSelect,
}: {
  placed: PlacedRoom
  originCm: { x: number; z: number }
  /** Click the room's floor to SELECT it (repositioning is done in the 2D plan panel, not here). */
  onSelect?: () => void
}) {
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
      <RoomFloor
        corners={design.corners}
        floorTexture={design.materials.floorTexture}
        frame={frame}
        onPointerDown={
          onSelect
            ? (e) => {
                e.stopPropagation()
                onSelect()
              }
            : undefined
        }
      />
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
  // Whole-house mode has its OWN hardcoded fill (separate from E's LightingRig). Scale it by the
  // same fillScale so "lamps off → daylight only" darkens the house here too, not just single-room.
  const fillScale = useLighting((s) => s.fillScale)
  const originCm = { x: bounds.cx, z: bounds.cz }
  const shadowScale = (Math.max(bounds.w, bounds.d, 300) / 100) * 1.4

  // ── Click a room to SELECT it (opens the W×D resize editor + makes it the active room). ─────────
  // Repositioning rooms now lives in the 2D Floor-plan panel (PlanArranger): a flat top-down plan is
  // the industry-standard surface for arranging rooms (Floorplanner/RoomSketcher), and a 2D drag maps
  // 1:1 to a floor coordinate with edge snapping — unlike the old depth-ambiguous drag-in-perspective
  // that fought OrbitControls. This 3D whole-house view is now a live, read-only PREVIEW; clicking a
  // room only selects it.
  const resizeRoom = useHouse((s) => s.resizeRoom)
  const switchRoom = useHouse((s) => s.switchRoom)
  const unit = useStore((s) => s.design.unit)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selectRoom = (id: string) => {
    switchRoom(id) // keep the 3D selection in sync with the 2D plan panel's active room
    setSelectedId((cur) => (cur === id ? null : id))
  }

  const selected = selectedId ? placed.find((p) => p.design.id === selectedId) ?? null : null

  return (
    <>
      {/* Even, global lighting for the overview (per-room task lights would be at the
          wrong place once rooms are spread out). The sun adds soft directional shadows. */}
      <hemisphereLight color="#ffffff" groundColor="#cfcbc2" intensity={0.9 * fillScale} />
      <ambientLight intensity={0.42 * fillScale} />
      <Sun houseHalfExtentM={houseHalfExtentM} />

      {placed.map((p, i) => (
        <RoomShell
          key={`${p.design.id}_${i}`}
          placed={p}
          originCm={originCm}
          onSelect={() => selectRoom(p.design.id)}
        />
      ))}

      {/* Floating size editor for the clicked room. */}
      {selected && (
        <RoomSizeEditor
          key={selected.design.id}
          placed={selected}
          originCm={originCm}
          unit={unit}
          onResize={(size) => resizeRoom(selected.design.id, size)}
          onClose={() => setSelectedId(null)}
        />
      )}

      <ContactShadows position={[0, 0.002, 0]} scale={shadowScale} resolution={1024} blur={2.6} opacity={0.34} far={6} />
      <HouseCameraFit bounds={bounds} />
    </>
  )
}

// ── Per-room size editor ──────────────────────────────────────────────────────
// A small DOM panel floated (drei <Html>) above the clicked room. Editing W or D
// commits through resizeRoom(); it is keyed on the room id in HouseView so it
// remounts (and re-reads the new size) after each resize settles.
function RoomSizeEditor({
  placed,
  originCm,
  unit,
  onResize,
  onClose,
}: {
  placed: PlacedRoom
  originCm: { x: number; z: number }
  unit: Unit
  onResize: (size: { w: number; l: number }) => void
  onClose: () => void
}) {
  const bb = bbox(placed.design.corners)
  const wx = (placed.centerCm.x - originCm.x) / 100
  const wz = (placed.centerCm.z - originCm.z) / 100
  const y = placed.design.wallHeight / 100 + 0.45
  return (
    <Html position={[wx, y, wz]} center distanceFactor={11} zIndexRange={[120, 0]} style={{ pointerEvents: 'auto' }}>
      <div onPointerDown={(e) => e.stopPropagation()} style={editorWrap}>
        <div style={editorHead}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{placed.design.name}</span>
          <button onClick={onClose} title="Done" style={editorClose}>✕</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <SizeField label="W" cm={bb.w} unit={unit} onCommit={(v) => onResize({ w: v, l: bb.d })} />
          <span style={{ color: '#9aa' }}>×</span>
          <SizeField label="D" cm={bb.d} unit={unit} onCommit={(v) => onResize({ w: bb.w, l: v })} />
        </div>
        <div style={editorHint}>Resize room ({unit})</div>
      </div>
    </Html>
  )
}

function SizeField({
  label,
  cm,
  unit,
  onCommit,
}: {
  label: string
  cm: number
  unit: Unit
  onCommit: (cm: number) => void
}) {
  // While editing we show the raw draft; otherwise we ALWAYS derive the displayed
  // value from the authoritative `cm` prop. So after a commit the field reflects the
  // room's real size even when it was clamped to a value that rounds the same (e.g.
  // typing below the 120cm min) — the case a remount-key alone would miss.
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState('')
  const shown = focused ? draft : formatLenShort(cm, unit)
  const commit = () => {
    setFocused(false)
    const parsed = parseLen(draft, unit)
    if (parsed != null && Math.abs(parsed - cm) > 0.5) onCommit(parsed) // else revert (no-op)
  }
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      <span style={{ color: '#9aa', fontSize: 11 }}>{label}</span>
      <input
        value={shown}
        onFocus={() => { setDraft(formatLenShort(cm, unit)); setFocused(true) }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') { setDraft(formatLenShort(cm, unit)); (e.target as HTMLInputElement).blur() }
        }}
        style={sizeInput}
      />
    </label>
  )
}

const editorWrap: CSSProperties = {
  background: 'rgba(20,22,26,.92)', color: '#e9eaec', borderRadius: 10, padding: '9px 11px',
  font: '13px ui-sans-serif,system-ui,sans-serif', boxShadow: '0 8px 24px rgba(0,0,0,.35)', minWidth: 168,
}
const editorHead: CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
  fontWeight: 700, color: '#8ab4ff', marginBottom: 7, maxWidth: 150,
}
const editorClose: CSSProperties = {
  border: 'none', background: 'transparent', color: '#c9ccd1', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0, flex: 'none',
}
const editorHint: CSSProperties = { marginTop: 6, fontSize: 11, color: '#9aa' }
const sizeInput: CSSProperties = {
  width: 56, background: '#2b2f36', border: '1px solid rgba(255,255,255,.16)', color: '#fff',
  borderRadius: 6, padding: '4px 6px', font: '13px ui-monospace,monospace',
}
