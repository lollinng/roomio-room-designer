// A faithful furnished-room harness (a "dollhouse cutaway": floor + back/left walls +
// furniture) to RUN and verify lighting + shadows, mirroring A's renderer setup. This is
// NOT app source — it stands in for A's <Room/> so the lighting library proves itself
// end-to-end before A mounts <LightingRig/> in the real scene.

import { LightingRig } from '../r3f/LightingRig'

// Room: 4m (x) x 5m (z), 2.7m walls, centered on origin (matches coords.ts convention).
const RW = 4
const RD = 5
const WH = 2.7
const WT = 0.12 // wall thickness

function Box(props: {
  pos: [number, number, number]
  size: [number, number, number]
  color: string
}) {
  return (
    <mesh position={props.pos} castShadow receiveShadow>
      <boxGeometry args={props.size} />
      <meshStandardMaterial color={props.color} roughness={0.85} metalness={0} />
    </mesh>
  )
}

export function Scene() {
  return (
    <>
      <LightingRig houseHalfExtentM={Math.max(RW, RD) / 2} />

      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[RW, RD]} />
        <meshStandardMaterial color="#c9bda8" roughness={0.95} />
      </mesh>

      {/* back wall (-z) */}
      <mesh position={[0, WH / 2, -RD / 2]} castShadow receiveShadow>
        <boxGeometry args={[RW, WH, WT]} />
        <meshStandardMaterial color="#e7e2d8" roughness={1} />
      </mesh>
      {/* left wall (-x) */}
      <mesh position={[-RW / 2, WH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[WT, WH, RD]} />
        <meshStandardMaterial color="#ded8cc" roughness={1} />
      </mesh>

      {/* furniture — boxes sized in meters, all cast + receive shadow */}
      {/* bed against left wall */}
      <Box pos={[-1.0, 0.28, -1.4]} size={[1.6, 0.55, 2.1]} color="#8a6f5a" />
      {/* wardrobe against back wall (tall -> long shadow) */}
      <Box pos={[1.3, 1.0, -2.1]} size={[1.0, 2.0, 0.55]} color="#5d4b3a" />
      {/* coffee/dining table center */}
      <Box pos={[0.4, 0.37, 0.6]} size={[1.2, 0.75, 0.8]} color="#7a5c43" />
      {/* sofa */}
      <Box pos={[-1.1, 0.4, 1.4]} size={[1.9, 0.8, 0.85]} color="#9a9388" />
      {/* small stool to show crisp contact shadow */}
      <Box pos={[1.2, 0.23, 1.2]} size={[0.4, 0.45, 0.4]} color="#b5793f" />
    </>
  )
}
