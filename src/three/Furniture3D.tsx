import { useMemo } from 'react'
import * as THREE from 'three'
import type { ModelKind } from '../data/archetypes'

// ---------------------------------------------------------------------------
// In-house parametric furniture. Each piece is composed from a handful of
// box / cylinder primitives whose geometry is derived from the passed
// dimensions (cm) on every render, so items are freely resizable and
// recolorable. The parent wraps this in a positioned + rotated group, so we
// render purely in LOCAL space:
//   - footprint centered at x=0, z=0
//   - base on the floor at y=0, top at y = h/100
//   - width spans X, depth spans Z, height spans Y
// ---------------------------------------------------------------------------

const CM = 0.01 // cm -> meters

// Derive a tonal variant of the primary color (factor < 1 darkens, > 1 lightens).
function shade(color: string, factor: number): string {
  const c = new THREE.Color(color)
  if (factor >= 1) {
    // lighten toward white
    const t = Math.min(1, factor - 1)
    c.lerp(new THREE.Color('#ffffff'), t)
  } else {
    c.multiplyScalar(Math.max(0, factor))
  }
  return `#${c.getHexString()}`
}

const METAL = '#8a8a8a'
const DARK = '#2c2f33'
const GLASS = '#1c2226'

// A simple shadow-casting standard-material box helper.
function Box({
  size,
  pos,
  color,
  roughness = 0.7,
  metalness = 0,
}: {
  size: [number, number, number]
  pos: [number, number, number]
  color: string
  roughness?: number
  metalness?: number
}): JSX.Element {
  return (
    <mesh position={pos} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} />
    </mesh>
  )
}

function Cyl({
  rTop,
  rBottom,
  height,
  pos,
  color,
  segments = 24,
  roughness = 0.6,
  metalness = 0,
  rotation,
}: {
  rTop: number
  rBottom: number
  height: number
  pos: [number, number, number]
  color: string
  segments?: number
  roughness?: number
  metalness?: number
  rotation?: [number, number, number]
}): JSX.Element {
  return (
    <mesh position={pos} rotation={rotation} castShadow receiveShadow>
      <cylinderGeometry args={[rTop, rBottom, height, segments]} />
      <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} />
    </mesh>
  )
}

// ---------------------------------------------------------------------------
// Per-model builders. Each returns an array of meshes composed in local space.
// ---------------------------------------------------------------------------

function buildSofa(W: number, D: number, H: number, color: string): JSX.Element {
  const legColor = shade(color, 0.45)
  const cushColor = shade(color, 1.12)
  const footH = Math.min(0.08, H * 0.12)
  const armW = Math.min(0.16, W * 0.16)
  const backT = Math.min(0.12, D * 0.16)
  const seatTop = Math.min(H * 0.5, 0.45)
  const seatH = seatTop - footH

  // Seat base block (sits between arms, in front of the back)
  const baseW = W - armW * 2
  const baseD = D - backT
  const baseY = footH + seatH / 2
  const baseZ = backT / 2 // shifted toward +z (front) since back occupies -z

  // Backrest along -z
  const backH = H - footH
  const backZ = -D / 2 + backT / 2

  // Cushions on top of the seat
  const nCush = baseW > 1.4 ? 3 : 2
  const gap = 0.015
  const cushTotalW = baseW - gap * (nCush + 1)
  const cushW = cushTotalW / nCush
  const cushH = Math.min(0.14, seatH * 0.7)
  const cushD = baseD * 0.92
  const cushY = footH + seatH + cushH / 2
  const cushions: JSX.Element[] = []
  for (let i = 0; i < nCush; i++) {
    const x = -baseW / 2 + gap * (i + 1) + cushW * (i + 0.5)
    cushions.push(
      <Box key={`c${i}`} size={[cushW, cushH, cushD]} pos={[x, cushY, baseZ]} color={cushColor} roughness={0.85} />,
    )
  }

  // Back cushions (leaning against backrest)
  const backCushH = (backH - seatH) * 0.7
  const backCushY = footH + seatH + backCushH / 2
  const backCushZ = -D / 2 + backT + cushD * 0.18

  const legInset = Math.min(0.06, W * 0.08)
  const legR = Math.min(0.03, footH * 0.6)
  const legPositions: [number, number][] = [
    [-W / 2 + legInset, -D / 2 + legInset],
    [W / 2 - legInset, -D / 2 + legInset],
    [-W / 2 + legInset, D / 2 - legInset],
    [W / 2 - legInset, D / 2 - legInset],
  ]

  return (
    <group>
      {/* feet */}
      {legPositions.map(([x, z], i) => (
        <Cyl key={`leg${i}`} rTop={legR} rBottom={legR * 0.8} height={footH} pos={[x, footH / 2, z]} color={legColor} segments={10} roughness={0.4} metalness={0.3} />
      ))}
      {/* seat base */}
      <Box size={[baseW, seatH, baseD]} pos={[0, baseY, baseZ]} color={color} roughness={0.8} />
      {/* backrest */}
      <Box size={[W, backH, backT]} pos={[0, footH + backH / 2, backZ]} color={color} roughness={0.8} />
      {/* arms */}
      <Box size={[armW, backH * 0.78, D]} pos={[-W / 2 + armW / 2, footH + (backH * 0.78) / 2, 0]} color={color} roughness={0.8} />
      <Box size={[armW, backH * 0.78, D]} pos={[W / 2 - armW / 2, footH + (backH * 0.78) / 2, 0]} color={color} roughness={0.8} />
      {/* seat cushions */}
      {cushions}
      {/* back cushion */}
      <Box size={[baseW, backCushH, Math.min(0.1, backT)]} pos={[0, backCushY, backCushZ]} color={cushColor} roughness={0.85} />
    </group>
  )
}

function buildSectional(W: number, D: number, H: number, color: string): JSX.Element {
  const legColor = shade(color, 0.45)
  const cushColor = shade(color, 1.12)
  const footH = Math.min(0.08, H * 0.12)
  const backT = 0.12
  const armW = 0.16
  const seatTop = Math.min(H * 0.5, 0.45)
  const seatH = seatTop - footH

  // Main run occupies the back along -z (full width). Chaise return runs along
  // the +x side toward +z.
  const runD = Math.min(D * 0.55, 0.95) // depth of the main run
  const chaiseW = Math.min(W * 0.42, 1.0) // width of the chaise leg

  const backH = H - footH

  // Main run seat
  const mainSeatW = W - armW
  const mainSeatD = runD - backT
  const mainSeatZ = -D / 2 + backT + mainSeatD / 2

  // Chaise (extends forward on +x side)
  const chaiseD = D - runD
  const chaiseZ = -D / 2 + runD + chaiseD / 2
  const chaiseX = W / 2 - chaiseW / 2

  const cushH = Math.min(0.14, seatH * 0.7)
  const cushY = footH + seatH + cushH / 2

  return (
    <group>
      {/* feet (corners) */}
      {(
        [
          [-W / 2 + 0.07, -D / 2 + 0.07],
          [W / 2 - 0.07, -D / 2 + 0.07],
          [W / 2 - 0.07, D / 2 - 0.07],
          [-W / 2 + 0.07, runD - D / 2 - 0.07],
        ] as [number, number][]
      ).map(([x, z], i) => (
        <Cyl key={`leg${i}`} rTop={0.025} rBottom={0.02} height={footH} pos={[x, footH / 2, z]} color={legColor} segments={10} roughness={0.4} metalness={0.3} />
      ))}

      {/* main run seat base */}
      <Box size={[mainSeatW, seatH, mainSeatD]} pos={[-armW / 2, footH + seatH / 2, mainSeatZ]} color={color} roughness={0.8} />
      {/* chaise seat base */}
      <Box size={[chaiseW, seatH, chaiseD]} pos={[chaiseX, footH + seatH / 2, chaiseZ]} color={color} roughness={0.8} />

      {/* backrest along -z (full width) */}
      <Box size={[W, backH, backT]} pos={[0, footH + backH / 2, -D / 2 + backT / 2]} color={color} roughness={0.8} />
      {/* outer arm on -x (left) */}
      <Box size={[armW, backH * 0.78, runD]} pos={[-W / 2 + armW / 2, footH + (backH * 0.78) / 2, -D / 2 + runD / 2]} color={color} roughness={0.8} />
      {/* arm on the +x side spanning full depth (outer edge of chaise) */}
      <Box size={[armW, backH * 0.78, D]} pos={[W / 2 - armW / 2, footH + (backH * 0.78) / 2, 0]} color={color} roughness={0.8} />

      {/* cushions: 2 on main run + 1 on chaise */}
      <Box size={[mainSeatW * 0.46, cushH, mainSeatD * 0.9]} pos={[-armW / 2 - mainSeatW * 0.24, cushY, mainSeatZ]} color={cushColor} roughness={0.85} />
      <Box size={[mainSeatW * 0.46, cushH, mainSeatD * 0.9]} pos={[-armW / 2 + mainSeatW * 0.24, cushY, mainSeatZ]} color={cushColor} roughness={0.85} />
      <Box size={[chaiseW * 0.86, cushH, chaiseD * 0.9]} pos={[chaiseX, cushY, chaiseZ]} color={cushColor} roughness={0.85} />
    </group>
  )
}

function buildBed(W: number, D: number, H: number, color: string): JSX.Element {
  const frameColor = shade(color, 0.5)
  const linen = shade(color, 1.18)
  const pillowColor = shade(color, 1.32)

  const frameH = Math.min(0.3, H * 0.35)
  const mattressH = Math.min(0.26, H * 0.32)
  const headboardH = H // headboard reaches full height
  const headboardT = Math.min(0.08, D * 0.06)

  const frameInset = 0.02
  const mattW = W - frameInset * 2
  const mattD = D - headboardT - frameInset
  const mattZ = -D / 2 + headboardT + mattD / 2 + frameInset / 2
  const mattY = frameH + mattressH / 2

  // duvet sits on the mattress, covering most of it
  const duvetH = 0.06
  const duvetD = mattD * 0.72
  const duvetZ = -D / 2 + headboardT + frameInset + duvetD / 2 + mattD * 0.26
  const duvetY = frameH + mattressH + duvetH / 2

  // pillows near the headboard
  const pillowH = 0.1
  const pillowW = Math.min(mattW * 0.42, 0.55)
  const pillowD = Math.min(mattD * 0.22, 0.4)
  const pillowZ = -D / 2 + headboardT + frameInset + pillowD / 2 + 0.04
  const pillowY = frameH + mattressH + pillowH / 2
  const pillowGap = mattW > 1.2 ? mattW * 0.24 : 0

  return (
    <group>
      {/* low frame */}
      <Box size={[W, frameH, D - headboardT]} pos={[0, frameH / 2, -D / 2 + headboardT + (D - headboardT) / 2]} color={frameColor} roughness={0.6} />
      {/* headboard */}
      <Box size={[W, headboardH, headboardT]} pos={[0, headboardH / 2, -D / 2 + headboardT / 2]} color={frameColor} roughness={0.6} />
      {/* mattress */}
      <Box size={[mattW, mattressH, mattD]} pos={[0, mattY, mattZ]} color={linen} roughness={0.9} />
      {/* duvet */}
      <Box size={[mattW * 0.98, duvetH, duvetD]} pos={[0, duvetY, duvetZ]} color={color} roughness={0.88} />
      {/* pillows */}
      {pillowGap > 0 ? (
        <>
          <Box size={[pillowW, pillowH, pillowD]} pos={[-pillowGap / 2, pillowY, pillowZ]} color={pillowColor} roughness={0.92} />
          <Box size={[pillowW, pillowH, pillowD]} pos={[pillowGap / 2, pillowY, pillowZ]} color={pillowColor} roughness={0.92} />
        </>
      ) : (
        <Box size={[Math.min(mattW * 0.8, 0.6), pillowH, pillowD]} pos={[0, pillowY, pillowZ]} color={pillowColor} roughness={0.92} />
      )}
    </group>
  )
}

function buildTable(W: number, D: number, H: number, color: string): JSX.Element {
  const legColor = shade(color, 0.55)
  const topT = Math.min(0.05, H * 0.12)
  const legR = Math.min(0.035, W * 0.05)
  const legH = H - topT
  const inset = Math.max(legR + 0.01, Math.min(0.07, W * 0.1))
  const legY = legH / 2
  const corners: [number, number][] = [
    [-W / 2 + inset, -D / 2 + inset],
    [W / 2 - inset, -D / 2 + inset],
    [-W / 2 + inset, D / 2 - inset],
    [W / 2 - inset, D / 2 - inset],
  ]
  return (
    <group>
      {/* top slab */}
      <Box size={[W, topT, D]} pos={[0, H - topT / 2, 0]} color={color} roughness={0.45} />
      {/* legs */}
      {corners.map(([x, z], i) => (
        <Box key={`l${i}`} size={[legR * 2, legH, legR * 2]} pos={[x, legY, z]} color={legColor} roughness={0.5} />
      ))}
    </group>
  )
}

function buildRoundTable(W: number, D: number, H: number, color: string): JSX.Element {
  const legColor = shade(color, 0.55)
  const r = Math.min(W, D) / 2
  const topT = Math.min(0.05, H * 0.12)
  const pedH = H - topT
  return (
    <group>
      {/* top */}
      <Cyl rTop={r} rBottom={r} height={topT} pos={[0, H - topT / 2, 0]} color={color} segments={40} roughness={0.45} />
      {/* central pedestal */}
      <Cyl rTop={r * 0.16} rBottom={r * 0.2} height={pedH} pos={[0, pedH / 2, 0]} color={legColor} segments={24} roughness={0.5} />
      {/* foot base */}
      <Cyl rTop={r * 0.42} rBottom={r * 0.46} height={Math.min(0.04, H * 0.06)} pos={[0, Math.min(0.02, H * 0.03), 0]} color={legColor} segments={28} roughness={0.5} />
    </group>
  )
}

function buildChair(W: number, D: number, H: number, color: string): JSX.Element {
  const legColor = shade(color, 0.5)
  const seatH = Math.min(0.46, H * 0.5)
  const seatT = Math.min(0.05, seatH * 0.12)
  const legR = Math.min(0.02, W * 0.05)
  const legH = seatH - seatT
  const inset = legR + 0.02
  const backT = Math.min(0.04, D * 0.08)
  const backH = H - seatH

  const corners: [number, number][] = [
    [-W / 2 + inset, -D / 2 + inset],
    [W / 2 - inset, -D / 2 + inset],
    [-W / 2 + inset, D / 2 - inset],
    [W / 2 - inset, D / 2 - inset],
  ]
  return (
    <group>
      {/* legs */}
      {corners.map(([x, z], i) => (
        <Box key={`l${i}`} size={[legR * 2, legH, legR * 2]} pos={[x, legH / 2, z]} color={legColor} roughness={0.5} />
      ))}
      {/* seat */}
      <Box size={[W, seatT, D]} pos={[0, seatH - seatT / 2, 0]} color={color} roughness={0.7} />
      {/* backrest (along -z) */}
      <Box size={[W * 0.92, backH, backT]} pos={[0, seatH + backH / 2, -D / 2 + backT / 2]} color={color} roughness={0.7} />
    </group>
  )
}

function buildOfficeChair(W: number, D: number, H: number, color: string): JSX.Element {
  const seatH = Math.min(0.5, H * 0.46)
  const seatT = Math.min(0.08, seatH * 0.18)
  const seatW = W * 0.78
  const seatD = D * 0.78
  const backH = H - seatH
  const backT = Math.min(0.06, D * 0.1)

  const baseH = 0.04
  const postH = seatH - baseH - seatT
  const postR = Math.min(0.025, W * 0.05)
  const armR = Math.max(W, D) / 2

  // 5-star base spokes
  const spokes: JSX.Element[] = []
  const casters: JSX.Element[] = []
  const spokeLen = armR * 0.85
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    const x = Math.cos(a) * (spokeLen * 0.5)
    const z = Math.sin(a) * (spokeLen * 0.5)
    spokes.push(
      <mesh key={`sp${i}`} position={[x, baseH / 2 + 0.02, z]} rotation={[0, -a, 0]} castShadow receiveShadow>
        <boxGeometry args={[spokeLen, 0.03, 0.05]} />
        <meshStandardMaterial color={DARK} roughness={0.5} metalness={0.3} />
      </mesh>,
    )
    const cx = Math.cos(a) * spokeLen
    const cz = Math.sin(a) * spokeLen
    casters.push(
      <Cyl key={`ca${i}`} rTop={0.025} rBottom={0.025} height={0.04} pos={[cx, 0.025, cz]} color={DARK} segments={12} rotation={[Math.PI / 2, 0, 0]} roughness={0.4} metalness={0.4} />,
    )
  }

  return (
    <group>
      {casters}
      {spokes}
      {/* central post */}
      <Cyl rTop={postR} rBottom={postR * 1.1} height={postH} pos={[0, baseH + postH / 2, 0]} color={METAL} segments={16} roughness={0.35} metalness={0.6} />
      {/* seat */}
      <Box size={[seatW, seatT, seatD]} pos={[0, seatH - seatT / 2, 0]} color={color} roughness={0.65} />
      {/* backrest */}
      <Box size={[seatW * 0.95, backH, backT]} pos={[0, seatH + backH / 2, -seatD / 2 + backT / 2]} color={DARK} roughness={0.6} />
    </group>
  )
}

function buildCabinet(W: number, D: number, H: number, color: string): JSX.Element {
  const bodyColor = color
  const topColor = shade(color, 0.85)
  const doorColor = shade(color, 1.06)
  const handleColor = METAL

  const toeH = Math.min(0.06, H * 0.08)
  const topT = Math.min(0.04, H * 0.06)
  const bodyH = H - toeH
  const doorInset = 0.015
  const doorT = Math.min(0.02, D * 0.06)
  const doorH = bodyH - topT - doorInset * 2
  const gap = 0.012
  const doorW = (W - doorInset * 2 - gap) / 2
  const doorY = toeH + doorInset + doorH / 2
  const doorZ = D / 2 - doorT / 2

  const handleH = Math.min(0.12, doorH * 0.3)
  const handleR = 0.008

  return (
    <group>
      {/* toe-kick base */}
      <Box size={[W * 0.94, toeH, D * 0.9]} pos={[0, toeH / 2, 0]} color={shade(color, 0.5)} roughness={0.6} />
      {/* body */}
      <Box size={[W, bodyH, D]} pos={[0, toeH + bodyH / 2, 0]} color={bodyColor} roughness={0.55} />
      {/* top slab overhang */}
      <Box size={[W * 1.03, topT, D * 1.06]} pos={[0, toeH + bodyH + topT / 2, 0]} color={topColor} roughness={0.45} />
      {/* two doors on +z */}
      <Box size={[doorW, doorH, doorT]} pos={[-doorW / 2 - gap / 2, doorY, doorZ + doorT / 2]} color={doorColor} roughness={0.5} />
      <Box size={[doorW, doorH, doorT]} pos={[doorW / 2 + gap / 2, doorY, doorZ + doorT / 2]} color={doorColor} roughness={0.5} />
      {/* handles (inner edges) */}
      <Cyl rTop={handleR} rBottom={handleR} height={handleH} pos={[-gap / 2 - 0.025, doorY, doorZ + doorT]} color={handleColor} segments={10} roughness={0.3} metalness={0.7} />
      <Cyl rTop={handleR} rBottom={handleR} height={handleH} pos={[gap / 2 + 0.025, doorY, doorZ + doorT]} color={handleColor} segments={10} roughness={0.3} metalness={0.7} />
    </group>
  )
}

function buildOpenShelf(W: number, D: number, H: number, color: string): JSX.Element {
  const frameColor = color
  const backColor = shade(color, 0.8)
  const panelT = Math.min(0.03, W * 0.04)
  const backT = 0.012

  // number of interior shelves
  const nGaps = H > 1.6 ? 4 : 3
  const innerH = H - panelT * 2
  const shelves: JSX.Element[] = []
  for (let i = 1; i < nGaps; i++) {
    const y = panelT + (innerH / nGaps) * i
    shelves.push(
      <Box key={`sh${i}`} size={[W - panelT * 2, panelT * 0.7, D - backT]} pos={[0, y, backT / 2]} color={frameColor} roughness={0.55} />,
    )
  }

  return (
    <group>
      {/* sides */}
      <Box size={[panelT, H, D]} pos={[-W / 2 + panelT / 2, H / 2, 0]} color={frameColor} roughness={0.55} />
      <Box size={[panelT, H, D]} pos={[W / 2 - panelT / 2, H / 2, 0]} color={frameColor} roughness={0.55} />
      {/* top + bottom */}
      <Box size={[W, panelT, D]} pos={[0, H - panelT / 2, 0]} color={frameColor} roughness={0.55} />
      <Box size={[W, panelT, D]} pos={[0, panelT / 2, 0]} color={frameColor} roughness={0.55} />
      {/* back panel */}
      <Box size={[W - panelT * 2, H - panelT * 2, backT]} pos={[0, H / 2, -D / 2 + backT / 2]} color={backColor} roughness={0.7} />
      {/* shelves */}
      {shelves}
    </group>
  )
}

function buildRug(W: number, D: number, H: number, color: string): JSX.Element {
  const thick = Math.max(0.005, H) // h is tiny (cm)
  const borderColor = shade(color, 0.78)
  const inset = Math.min(W, D) * 0.08
  return (
    <group>
      {/* main rug slab, sits flat on floor */}
      <mesh position={[0, thick / 2, 0]} receiveShadow>
        <boxGeometry args={[W, thick, D]} />
        <meshStandardMaterial color={color} roughness={0.95} metalness={0} />
      </mesh>
      {/* inset border stripe (a slightly raised thin frame drawn as a darker top slab) */}
      <mesh position={[0, thick + 0.0006, 0]}>
        <boxGeometry args={[W - inset, 0.001, D - inset]} />
        <meshStandardMaterial color={borderColor} roughness={0.95} metalness={0} />
      </mesh>
    </group>
  )
}

function buildLamp(W: number, D: number, H: number, color: string): JSX.Element {
  const poleColor = shade(color, 0.5)
  const shadeColor = shade('#f2dba0', 1.0) // warm shade, independent of body
  const baseR = Math.min(W, D) / 2
  const baseH = Math.min(0.03, H * 0.03)
  const poleR = Math.max(0.012, baseR * 0.12)
  const shadeH = Math.min(0.28, H * 0.22)
  const shadeTopR = baseR * 0.7
  const shadeBotR = baseR * 0.95
  const poleH = H - baseH - shadeH
  return (
    <group>
      {/* base disc */}
      <Cyl rTop={baseR} rBottom={baseR} height={baseH} pos={[0, baseH / 2, 0]} color={poleColor} segments={28} roughness={0.4} metalness={0.5} />
      {/* pole */}
      <Cyl rTop={poleR} rBottom={poleR} height={poleH} pos={[0, baseH + poleH / 2, 0]} color={poleColor} segments={16} roughness={0.4} metalness={0.5} />
      {/* shade (truncated cone), faintly emissive warm glow */}
      <mesh position={[0, baseH + poleH + shadeH / 2, 0]} castShadow>
        <cylinderGeometry args={[shadeTopR, shadeBotR, shadeH, 28, 1, true]} />
        <meshStandardMaterial
          color={shadeColor}
          emissive={'#ffd98a'}
          emissiveIntensity={0.45}
          roughness={0.7}
          metalness={0}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}

function buildPlant(W: number, D: number, H: number, color: string): JSX.Element {
  // pot uses a warm terracotta-ish tone derived from a fixed base; foliage uses
  // the piece color (which defaults to a green).
  const potColor = '#a8623f'
  const foliage = color
  const foliageDark = shade(color, 0.7)
  const potH = Math.min(H * 0.32, 0.34)
  const potTopR = Math.min(W, D) / 2
  const potBotR = potTopR * 0.7
  const foliageBottom = potH * 0.85
  const foliageH = H - foliageBottom
  const clusterR = Math.min(W, D) / 2

  return (
    <group>
      {/* pot (truncated cone) */}
      <Cyl rTop={potTopR} rBottom={potBotR} height={potH} pos={[0, potH / 2, 0]} color={potColor} segments={20} roughness={0.8} />
      {/* soil */}
      <Cyl rTop={potTopR * 0.92} rBottom={potTopR * 0.92} height={0.02} pos={[0, potH - 0.01, 0]} color={'#3a2a1e'} segments={20} roughness={1} />
      {/* foliage: cluster of spheres + a top cone */}
      <mesh position={[0, foliageBottom + foliageH * 0.35, 0]} castShadow receiveShadow>
        <sphereGeometry args={[clusterR * 0.95, 16, 14]} />
        <meshStandardMaterial color={foliage} roughness={0.85} />
      </mesh>
      <mesh position={[-clusterR * 0.45, foliageBottom + foliageH * 0.55, clusterR * 0.25]} castShadow>
        <sphereGeometry args={[clusterR * 0.6, 14, 12]} />
        <meshStandardMaterial color={foliageDark} roughness={0.85} />
      </mesh>
      <mesh position={[clusterR * 0.4, foliageBottom + foliageH * 0.58, -clusterR * 0.2]} castShadow>
        <sphereGeometry args={[clusterR * 0.65, 14, 12]} />
        <meshStandardMaterial color={foliage} roughness={0.85} />
      </mesh>
      <mesh position={[0, foliageBottom + foliageH * 0.85, 0]} castShadow>
        <coneGeometry args={[clusterR * 0.6, foliageH * 0.5, 14]} />
        <meshStandardMaterial color={foliageDark} roughness={0.85} />
      </mesh>
    </group>
  )
}

function buildTv(W: number, D: number, H: number, color: string): JSX.Element {
  // Flat-screen TV: wide thin screen on a small pedestal stand. `color` tints the
  // stand/back; the screen face is a dark, faintly-emissive panel.
  const standH = Math.min(H * 0.2, 0.18)
  const screenH = H - standH
  const bezelT = Math.min(D, 0.08)
  const baseY = standH
  return (
    <group>
      {/* pedestal base plate */}
      <Box size={[W * 0.42, standH * 0.28, Math.max(D, 0.18)]} pos={[0, (standH * 0.28) / 2, 0]} color={DARK} roughness={0.5} metalness={0.3} />
      {/* neck */}
      <Box size={[W * 0.08, standH, Math.max(D, 0.18) * 0.45]} pos={[0, standH / 2, 0]} color={DARK} roughness={0.5} metalness={0.2} />
      {/* screen body / bezel */}
      <Box size={[W, screenH, bezelT]} pos={[0, baseY + screenH / 2, 0]} color={'#15171a'} roughness={0.5} metalness={0.2} />
      {/* screen face (slightly emissive so it reads as a display) */}
      <mesh position={[0, baseY + screenH / 2, bezelT / 2 + 0.002]} castShadow>
        <boxGeometry args={[W * 0.95, screenH * 0.9, 0.005]} />
        <meshStandardMaterial color={GLASS} emissive={'#0d1c2e'} emissiveIntensity={0.35} roughness={0.18} metalness={0.2} />
      </mesh>
    </group>
  )
}

function buildDesk(W: number, D: number, H: number, color: string): JSX.Element {
  // Modesty-panel desk: top slab on two side panels + a back panel; small drawer block.
  const panelColor = shade(color, 0.62)
  const topT = Math.min(0.05, H * 0.12)
  const panelT = Math.min(0.04, W * 0.05)
  const legH = H - topT
  const sideD = D * 0.9
  const drawerW = Math.min(W * 0.3, 0.45)
  const drawerH = Math.min(legH * 0.35, 0.18)
  const drawerColor = shade(color, 1.05)
  return (
    <group>
      {/* top slab */}
      <Box size={[W, topT, D]} pos={[0, H - topT / 2, 0]} color={color} roughness={0.45} />
      {/* side panels */}
      <Box size={[panelT, legH, sideD]} pos={[-W / 2 + panelT / 2, legH / 2, 0]} color={panelColor} roughness={0.5} />
      <Box size={[panelT, legH, sideD]} pos={[W / 2 - panelT / 2, legH / 2, 0]} color={panelColor} roughness={0.5} />
      {/* back modesty panel (upper, along -z) */}
      <Box size={[W - panelT * 2, legH * 0.55, 0.02]} pos={[0, legH * 0.7, -D / 2 + 0.02]} color={panelColor} roughness={0.55} />
      {/* drawer block under the top on +x side */}
      <Box size={[drawerW, drawerH, sideD * 0.92]} pos={[W / 2 - panelT - drawerW / 2 - 0.01, H - topT - drawerH / 2 - 0.01, 0]} color={drawerColor} roughness={0.5} />
      {/* drawer handle */}
      <Cyl rTop={0.008} rBottom={0.008} height={drawerW * 0.4} pos={[W / 2 - panelT - drawerW / 2 - 0.01, H - topT - drawerH / 2 - 0.01, D / 2 * 0.92 + 0.012]} color={METAL} segments={10} rotation={[0, 0, Math.PI / 2]} roughness={0.3} metalness={0.7} />
    </group>
  )
}

function buildOttoman(W: number, D: number, H: number, color: string): JSX.Element {
  // Soft upholstered ottoman / pouf. Round if footprint is ~square, else a block.
  const round = Math.abs(W - D) < 0.12
  const footH = Math.min(0.04, H * 0.16)
  const bodyH = H - footH
  const seam = shade(color, 0.86)
  if (round) {
    const r = Math.min(W, D) / 2
    return (
      <group>
        <Cyl rTop={r * 0.96} rBottom={r} height={bodyH} pos={[0, footH + bodyH / 2, 0]} color={color} segments={32} roughness={0.92} />
        {/* seam line */}
        <Cyl rTop={r * 1.01} rBottom={r * 1.01} height={0.012} pos={[0, footH + bodyH / 2, 0]} color={seam} segments={32} roughness={0.92} />
        {/* short feet */}
        {([[0.6, 0.6], [-0.6, 0.6], [0.6, -0.6], [-0.6, -0.6]] as [number, number][]).map(([fx, fz], i) => (
          <Cyl key={i} rTop={0.012} rBottom={0.012} height={footH} pos={[fx * r * 0.7, footH / 2, fz * r * 0.7]} color={shade(color, 0.45)} segments={8} roughness={0.4} metalness={0.3} />
        ))}
      </group>
    )
  }
  return (
    <group>
      <Box size={[W, bodyH, D]} pos={[0, footH + bodyH / 2, 0]} color={color} roughness={0.92} />
      {/* seam line around the middle */}
      <Box size={[W * 1.006, 0.012, D * 1.006]} pos={[0, footH + bodyH * 0.5, 0]} color={seam} roughness={0.92} />
      {/* feet */}
      {([[-1, -1], [1, -1], [-1, 1], [1, 1]] as [number, number][]).map(([sx, sz], i) => (
        <Cyl key={i} rTop={0.014} rBottom={0.014} height={footH} pos={[sx * (W / 2 - 0.06), footH / 2, sz * (D / 2 - 0.06)]} color={shade(color, 0.45)} segments={8} roughness={0.4} metalness={0.3} />
      ))}
    </group>
  )
}

function buildStool(W: number, D: number, H: number, color: string): JSX.Element {
  // Stool / bar stool. Tall (>70cm) → central post + base + footrest ring; else 4 legs.
  const legColor = shade(color, 0.5)
  const seatT = Math.min(0.06, H * 0.1)
  const seatTop = H
  const round = Math.abs(W - D) < 0.1
  const seatR = Math.min(W, D) / 2
  const seat = round ? (
    <Cyl rTop={seatR} rBottom={seatR * 0.96} height={seatT} pos={[0, seatTop - seatT / 2, 0]} color={color} segments={28} roughness={0.65} />
  ) : (
    <Box size={[W, seatT, D]} pos={[0, seatTop - seatT / 2, 0]} color={color} roughness={0.65} />
  )
  const tall = H > 0.7
  if (tall) {
    const postR = Math.min(0.03, W * 0.08)
    const baseR = Math.min(W, D) * 0.45
    const postH = seatTop - seatT
    return (
      <group>
        {seat}
        <Cyl rTop={postR} rBottom={postR} height={postH} pos={[0, postH / 2, 0]} color={METAL} segments={16} roughness={0.35} metalness={0.6} />
        <Cyl rTop={baseR} rBottom={baseR} height={0.02} pos={[0, 0.01, 0]} color={METAL} segments={28} roughness={0.35} metalness={0.6} />
        {/* footrest ring */}
        <mesh position={[0, H * 0.32, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[baseR * 0.8, 0.012, 8, 28]} />
          <meshStandardMaterial color={METAL} roughness={0.35} metalness={0.6} />
        </mesh>
      </group>
    )
  }
  const legH = seatTop - seatT
  const inset = Math.min(0.05, W * 0.12)
  const corners: [number, number][] = [
    [-W / 2 + inset, -D / 2 + inset],
    [W / 2 - inset, -D / 2 + inset],
    [-W / 2 + inset, D / 2 - inset],
    [W / 2 - inset, D / 2 - inset],
  ]
  return (
    <group>
      {seat}
      {corners.map(([x, z], i) => (
        <Cyl key={i} rTop={0.013} rBottom={0.016} height={legH} pos={[x, legH / 2, z]} color={legColor} segments={10} roughness={0.45} metalness={0.2} />
      ))}
    </group>
  )
}

function buildBench(W: number, D: number, H: number, color: string): JSX.Element {
  // Bench: long seat slab on two end supports; backrest only when tall.
  const supportColor = shade(color, 0.55)
  const cushColor = shade(color, 1.12)
  const hasBack = H > 0.6
  const seatTop = hasBack ? Math.min(0.46, H * 0.5) : H
  const seatT = Math.min(0.06, seatTop * 0.16)
  const panelT = Math.min(0.05, W * 0.06)
  const legH = seatTop - seatT
  return (
    <group>
      {/* end supports */}
      <Box size={[panelT, legH, D * 0.92]} pos={[-W / 2 + panelT / 2, legH / 2, 0]} color={supportColor} roughness={0.5} />
      <Box size={[panelT, legH, D * 0.92]} pos={[W / 2 - panelT / 2, legH / 2, 0]} color={supportColor} roughness={0.5} />
      {/* seat slab */}
      <Box size={[W, seatT, D]} pos={[0, seatTop - seatT / 2, 0]} color={color} roughness={0.6} />
      {/* thin cushion */}
      <Box size={[W * 0.96, 0.03, D * 0.9]} pos={[0, seatTop + 0.015, 0]} color={cushColor} roughness={0.88} />
      {/* backrest when tall */}
      {hasBack && (
        <Box size={[W, H - seatTop, Math.min(0.05, D * 0.12)]} pos={[0, seatTop + (H - seatTop) / 2, -D / 2 + Math.min(0.05, D * 0.12) / 2]} color={color} roughness={0.6} />
      )}
    </group>
  )
}

function buildMirror(W: number, D: number, H: number, color: string): JSX.Element {
  // Freestanding full-length mirror (also used for tall room dividers).
  const frameT = Math.min(Math.max(D, 0.03), 0.06)
  const frameW = Math.min(0.05, W * 0.1)
  return (
    <group>
      {/* frame slab */}
      <Box size={[W, H, frameT]} pos={[0, H / 2, 0]} color={color} roughness={0.5} />
      {/* reflective panel on +z */}
      <mesh position={[0, H / 2, frameT / 2 + 0.003]} castShadow receiveShadow>
        <boxGeometry args={[W - frameW * 2, H - frameW * 2, 0.008]} />
        <meshStandardMaterial color={'#ccd8de'} roughness={0.06} metalness={0.7} />
      </mesh>
      {/* back support strut (leans the mirror) */}
      <mesh position={[0, H * 0.42, -frameT / 2 - 0.04]} rotation={[0.16, 0, 0]} castShadow>
        <boxGeometry args={[W * 0.08, H * 0.7, 0.02]} />
        <meshStandardMaterial color={shade(color, 0.5)} roughness={0.5} />
      </mesh>
    </group>
  )
}

function buildBox(W: number, D: number, H: number, color: string): JSX.Element {
  const r = Math.min(W, D, H) * 0.06
  return (
    <group>
      <mesh position={[0, H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[W, H, D]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.05} />
      </mesh>
      {/* subtle darker edge frame to suggest rounded form without rounded geo cost */}
      {r > 0.005 ? (
        <mesh position={[0, H / 2, 0]}>
          <boxGeometry args={[W * 1.001, H * 0.04, D * 1.001]} />
          <meshStandardMaterial color={shade(color, 0.7)} roughness={0.6} />
        </mesh>
      ) : null}
    </group>
  )
}

// ---------------------------------------------------------------------------

export function FurnitureModel({
  model,
  w,
  d,
  h,
  color,
}: {
  model: ModelKind
  w: number
  d: number
  h: number
  color: string
}): JSX.Element {
  // Convert cm -> meters once; geometry is rebuilt whenever dims/color change.
  const content = useMemo(() => {
    const W = Math.max(0.01, w * CM)
    const D = Math.max(0.01, d * CM)
    const H = Math.max(0.01, h * CM)
    switch (model) {
      case 'sofa':
        return buildSofa(W, D, H, color)
      case 'sectional':
        return buildSectional(W, D, H, color)
      case 'bed':
        return buildBed(W, D, H, color)
      case 'table':
        return buildTable(W, D, H, color)
      case 'roundTable':
        return buildRoundTable(W, D, H, color)
      case 'chair':
        return buildChair(W, D, H, color)
      case 'officeChair':
        return buildOfficeChair(W, D, H, color)
      case 'cabinet':
        return buildCabinet(W, D, H, color)
      case 'openShelf':
        return buildOpenShelf(W, D, H, color)
      case 'rug':
        return buildRug(W, D, H, color)
      case 'lamp':
        return buildLamp(W, D, H, color)
      case 'plant':
        return buildPlant(W, D, H, color)
      case 'box':
        return buildBox(W, D, H, color)
      case 'tv':
        return buildTv(W, D, H, color)
      case 'desk':
        return buildDesk(W, D, H, color)
      case 'ottoman':
        return buildOttoman(W, D, H, color)
      case 'stool':
        return buildStool(W, D, H, color)
      case 'bench':
        return buildBench(W, D, H, color)
      case 'mirror':
        return buildMirror(W, D, H, color)
      default:
        return buildBox(W, D, H, color)
    }
  }, [model, w, d, h, color])

  return <group>{content}</group>
}
