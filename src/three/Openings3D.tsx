import * as THREE from 'three'
import type { Opening, Wall } from '../types'
import type { Frame } from './coords'
import { OPENING_MAP, type OpeningDef } from '../data/openings'
import { pointOnWall } from '../geometry/walls'

// ---- shared material palette ------------------------------------------------
const PAINT = '#f1efe9' // off-white painted frame / stile / rail
const GLASS = '#cfe3ea' // tinted glazing
const METAL = '#3a3a3a' // dark handle / threshold

const cm = (v: number) => v / 100 // centimeters -> meters (world units)

// Painted box (frames, leaves, panels, muntins).
function Paint({
  pos,
  size,
}: {
  pos: [number, number, number]
  size: [number, number, number]
}): JSX.Element {
  return (
    <mesh position={pos} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={PAINT} roughness={0.7} metalness={0} />
    </mesh>
  )
}

// Translucent glazing pane.
function GlassPane({
  pos,
  size,
}: {
  pos: [number, number, number]
  size: [number, number, number]
}): JSX.Element {
  return (
    <mesh position={pos}>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={GLASS}
        roughness={0.05}
        metalness={0}
        transparent
        opacity={0.22}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

// A thin muntin border drawn around a glass lite (top/bottom/left/right rails).
function MuntinBorder({
  w,
  h,
  z,
  bar,
}: {
  w: number
  h: number
  z: number
  bar: number
}): JSX.Element {
  return (
    <group>
      <Paint pos={[0, h / 2 - bar / 2, z]} size={[w, bar, bar]} />
      <Paint pos={[0, -h / 2 + bar / 2, z]} size={[w, bar, bar]} />
      <Paint pos={[-w / 2 + bar / 2, 0, z]} size={[bar, h - 2 * bar, bar]} />
      <Paint pos={[w / 2 - bar / 2, 0, z]} size={[bar, h - 2 * bar, bar]} />
    </group>
  )
}

/**
 * A single glazed leaf: a tinted pane in the central `glass` fraction with a
 * painted stile/rail surround and a small grid of muntins (divided lites).
 */
function GlazedLeaf({
  w,
  h,
  depth,
  glass,
  cols,
  rows,
}: {
  w: number
  h: number
  depth: number
  glass: number
  cols: number
  rows: number
}): JSX.Element {
  const slab = depth * 0.55
  const gw = w * glass
  const gh = h * glass
  const bar = Math.min(w, h) * 0.045
  const cellW = gw / cols
  const cellH = gh / rows
  const lites: JSX.Element[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = -gw / 2 + cellW * (c + 0.5)
      const cy = -gh / 2 + cellH * (r + 0.5)
      lites.push(
        <group key={`l${r}-${c}`} position={[cx, cy, 0]}>
          <GlassPane pos={[0, 0, 0]} size={[cellW, cellH, depth * 0.18]} />
          <MuntinBorder w={cellW} h={cellH} z={slab / 2} bar={bar} />
          <MuntinBorder w={cellW} h={cellH} z={-slab / 2} bar={bar} />
        </group>,
      )
    }
  }
  return (
    <group>
      {/* painted stile/rail surround framing the glazed area */}
      <Paint pos={[0, h / 2 - (h - gh) / 4, 0]} size={[w, (h - gh) / 2, slab]} />
      <Paint pos={[0, -h / 2 + (h - gh) / 4, 0]} size={[w, (h - gh) / 2, slab]} />
      <Paint pos={[-w / 2 + (w - gw) / 4, 0, 0]} size={[(w - gw) / 2, gh, slab]} />
      <Paint pos={[w / 2 - (w - gw) / 4, 0, 0]} size={[(w - gw) / 2, gh, slab]} />
      {lites}
    </group>
  )
}

/** A solid panel-door leaf with 1-2 recessed raised panels. */
function SolidLeaf({
  w,
  h,
  depth,
}: {
  w: number
  h: number
  depth: number
}): JSX.Element {
  const slab = depth * 0.6
  const border = Math.min(w, h) * 0.12
  const panelW = w - 2 * border
  const nPanels = h > w * 1.4 ? 2 : 1
  const gap = h * 0.04
  const panelH = (h - 2 * border - gap * (nPanels - 1)) / nPanels
  const panels: JSX.Element[] = []
  for (let i = 0; i < nPanels; i++) {
    const cy = h / 2 - border - panelH / 2 - i * (panelH + gap)
    // recessed raised panel: a slightly proud inner plate
    panels.push(
      <Paint
        key={`p${i}`}
        pos={[0, cy, slab / 2]}
        size={[panelW * 0.86, panelH * 0.86, depth * 0.18]}
      />,
    )
    panels.push(
      <Paint
        key={`pb${i}`}
        pos={[0, cy, -slab / 2]}
        size={[panelW * 0.86, panelH * 0.86, depth * 0.18]}
      />,
    )
  }
  return (
    <group>
      <Paint pos={[0, 0, 0]} size={[w, h, slab]} />
      {panels}
    </group>
  )
}

/** Dark metal lever handle on the leading edge of a door leaf. */
function Handle({
  x,
  depth,
}: {
  x: number
  depth: number
}): JSX.Element {
  const z = depth * 0.5
  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 0, z]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.018, 0.018, 0.05, 12]} />
        <meshStandardMaterial color={METAL} roughness={0.35} metalness={0.8} />
      </mesh>
      <mesh position={[0, 0, -z]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.018, 0.018, 0.05, 12]} />
        <meshStandardMaterial color={METAL} roughness={0.35} metalness={0.8} />
      </mesh>
    </group>
  )
}

/**
 * Render a door or window as parametric primitive meshes oriented within the
 * wall. The returned <group> is centered on the opening's wall position; the
 * parent owns all interaction (selection, delete, pointer handlers).
 */
export function OpeningMesh({
  opening,
  wall,
  frame,
  wallHeight: _wallHeight,
  wallThickness,
}: {
  opening: Opening
  wall: Wall
  frame: Frame
  wallHeight: number
  wallThickness: number
}): JSX.Element {
  const def: OpeningDef =
    OPENING_MAP[opening.style] ?? {
      style: opening.style,
      kind: opening.kind,
      name: opening.style,
      width: opening.width,
      height: opening.height,
      sill: opening.sill,
      leaves: 1,
      glass: opening.kind === 'window' ? 0.9 : 0,
    }

  const p = pointOnWall(wall, opening.t)
  const [wx, wz] = frame.toWorld(p.x, p.z)
  const yCenter = cm(opening.sill + opening.height / 2)
  const rotY = Math.atan2(-wall.dirZ, wall.dirX)

  // Local opening dimensions (centered at origin after the group transform).
  const W = cm(opening.width)
  const H = cm(opening.height)
  const depth = cm(wallThickness) + 0.02 // slightly proud on both wall faces

  // Outer frame / jamb thickness.
  const jamb = Math.min(W, H) * 0.06
  const isWindow = def.kind === 'window'
  const frameDepth = depth

  // Inner clear area (inside the jambs). Doors have no bottom rail.
  const sillBar = isWindow ? jamb * 1.2 : 0
  const innerW = W - 2 * jamb
  const innerTop = H / 2 - jamb
  const innerBottom = -H / 2 + sillBar
  const innerH = innerTop - innerBottom
  const innerCenterY = (innerTop + innerBottom) / 2

  // Frame border boxes: top + two sides (+ bottom rail/sill for windows).
  const frameBoxes: JSX.Element[] = [
    <Paint key="ft" pos={[0, H / 2 - jamb / 2, 0]} size={[W, jamb, frameDepth]} />,
    <Paint
      key="fl"
      pos={[-W / 2 + jamb / 2, innerCenterY, 0]}
      size={[jamb, innerH, frameDepth]}
    />,
    <Paint
      key="fr"
      pos={[W / 2 - jamb / 2, innerCenterY, 0]}
      size={[jamb, innerH, frameDepth]}
    />,
  ]
  if (isWindow) {
    // sill slab, slightly proud of the wall on the interior side
    frameBoxes.push(
      <Paint
        key="fb"
        pos={[0, -H / 2 + sillBar / 2, 0]}
        size={[W, sillBar, frameDepth * 1.25]}
      />,
    )
  }

  // Leaves: divide the inner clear width evenly.
  const leaves = Math.max(1, def.leaves)
  const leafGap = innerW * 0.012
  const leafW = (innerW - leafGap * (leaves - 1)) / leaves
  const leafH = innerH
  const leafItems: JSX.Element[] = []
  for (let i = 0; i < leaves; i++) {
    const lx = -innerW / 2 + leafW / 2 + i * (leafW + leafGap)
    if (def.glass > 0) {
      // Divided lites: more for wide/French/window styles, fewer for a plain glass door.
      const cols = isWindow ? 2 : leaves >= 2 ? 1 : 1
      const rows = isWindow ? 2 : leaves >= 2 ? 3 : 4
      leafItems.push(
        <group key={`leaf${i}`} position={[lx, innerCenterY, 0]}>
          <GlazedLeaf
            w={leafW}
            h={leafH}
            depth={depth}
            glass={def.glass}
            cols={cols}
            rows={rows}
          />
        </group>,
      )
    } else {
      leafItems.push(
        <group key={`leaf${i}`} position={[lx, innerCenterY, 0]}>
          <SolidLeaf w={leafW} h={leafH} depth={depth} />
        </group>,
      )
    }
  }

  // Door hardware + threshold.
  const extras: JSX.Element[] = []
  if (!isWindow) {
    if (leaves === 1) {
      // single door: handle near the leading (right) edge
      const hx = -innerW / 2 + leafW - leafW * 0.12
      extras.push(<Handle key="h0" x={hx} depth={depth} />)
    } else {
      // double / french / bifold: handles on the meeting stiles of the two
      // central leaves
      const li = Math.floor((leaves - 1) / 2)
      const ri = Math.ceil(leaves / 2)
      const lxL = -innerW / 2 + leafW / 2 + li * (leafW + leafGap)
      const lxR = -innerW / 2 + leafW / 2 + ri * (leafW + leafGap)
      extras.push(
        <Handle key="hl" x={lxL + leafW * 0.38} depth={depth} />,
        <Handle key="hr" x={lxR - leafW * 0.38} depth={depth} />,
      )
    }
    // subtle threshold line at the floor (local y = -H/2 maps to floor for doors)
    extras.push(
      <mesh key="thr" position={[0, -H / 2 + 0.005, 0]} receiveShadow>
        <boxGeometry args={[W, 0.012, depth * 0.9]} />
        <meshStandardMaterial color={METAL} roughness={0.6} metalness={0.3} />
      </mesh>,
    )
  } else if (leaves > 1) {
    // window mullion between the two sashes
    const mx = 0
    extras.push(
      <Paint
        key="mull"
        pos={[mx, innerCenterY, 0]}
        size={[leafGap + leafW * 0.04, innerH, frameDepth]}
      />,
    )
  }

  return (
    <group position={[wx, yCenter, wz]} rotation={[0, rotY, 0]}>
      {frameBoxes}
      {leafItems}
      {extras}
    </group>
  )
}
