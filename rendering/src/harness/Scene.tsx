// Standalone furnished room for the realism harness (decoupled from A's real scene, per the
// island convention). 4m x 5m room, 2.7m walls, floor + back/left walls, a handful of furniture
// boxes with A-like MeshStandard materials, a chrome sphere (showcases IBL reflections), and an
// emissive table lamp + ceiling bulb (showcase emissive + bloom). Lit by E-like default lights
// (hemisphere + ambient fill, a directional sun, point "bulbs") so the RealismLayer is enhancing
// the same kind of lighting it will in the app.

import * as THREE from 'three'
import { AreaLight } from '../r3f/AreaLight'

const RW = 4
const RD = 5
const WH = 2.7

interface FurnProps {
  position: [number, number, number]
  size: [number, number, number]
  color: string
  roughness?: number
  metalness?: number
  emissive?: string
  emissiveIntensity?: number
}

function Furn({ position, size, color, roughness = 0.7, metalness = 0, emissive, emissiveIntensity }: FurnProps) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        metalness={metalness}
        emissive={emissive ?? '#000000'}
        emissiveIntensity={emissiveIntensity ?? 0}
      />
    </mesh>
  )
}

export function HarnessScene({ bulbsOn = true }: { bulbsOn?: boolean }) {
  return (
    <group>
      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[RW, RD]} />
        <meshStandardMaterial color="#b9a98f" roughness={0.82} metalness={0} side={THREE.DoubleSide} />
      </mesh>
      {/* back wall (-z) */}
      <mesh position={[0, WH / 2, -RD / 2]} receiveShadow>
        <planeGeometry args={[RW, WH]} />
        <meshStandardMaterial color="#d8d2c6" roughness={0.95} metalness={0} side={THREE.DoubleSide} />
      </mesh>
      {/* left wall (-x) */}
      <mesh position={[-RW / 2, WH / 2, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[RD, WH]} />
        <meshStandardMaterial color="#d8d2c6" roughness={0.95} metalness={0} side={THREE.DoubleSide} />
      </mesh>

      {/* furniture (A-like materials: matte fabric, semi-gloss wood, brushed/polished metals) */}
      <Furn position={[-0.9, 0.3, -1.4]} size={[1.6, 0.6, 2.0]} color="#7d8a99" roughness={0.75} /> {/* bed */}
      <Furn position={[1.45, 1.0, -2.0]} size={[1.0, 2.0, 0.55]} color="#6b5640" roughness={0.6} metalness={0.1} /> {/* wardrobe */}
      <Furn position={[0.7, 0.35, 0.9]} size={[1.3, 0.7, 0.8]} color="#9a9488" roughness={0.6} /> {/* sofa */}
      <Furn position={[-0.4, 0.25, 1.25]} size={[0.95, 0.5, 0.55]} color="#caa15a" roughness={0.5} metalness={0.15} /> {/* table */}
      <Furn position={[1.5, 0.22, 1.5]} size={[0.4, 0.44, 0.4]} color="#3a3a3a" roughness={0.3} metalness={0.6} /> {/* metal stool */}

      {/* polished chrome sphere — the clearest IBL reflection showcase (dull in flat, mirror in realism) */}
      <mesh position={[0, 0.6, -0.1]} castShadow>
        <sphereGeometry args={[0.36, 48, 48]} />
        <meshStandardMaterial color="#cfd2d6" roughness={0.08} metalness={1.0} />
      </mesh>

      {/* table lamp: a coupled bulb — emissive shade (blooms after the enhancer boost) + its point
          light. `bulbsOn` toggles BOTH together, so turning it off removes the light AND the glow
          (the "toggling a bulb changes light + glow" behaviour, as in-app once fixtures attach to E's lights). */}
      <group position={[-1.45, 0, 1.7]}>
        <mesh position={[0, 0.18, 0]} castShadow>
          <cylinderGeometry args={[0.03, 0.03, 0.5, 12]} />
          <meshStandardMaterial color="#8a7a55" roughness={0.4} metalness={0.5} />
        </mesh>
        <mesh position={[0, 0.46, 0]} castShadow>
          <cylinderGeometry args={[0.16, 0.22, 0.28, 24]} />
          <meshStandardMaterial
            color="#f2dba0"
            emissive="#ffd98a"
            emissiveIntensity={bulbsOn ? 0.45 : 0}
            roughness={0.7}
            metalness={0}
          />
        </mesh>
        {bulbsOn && <pointLight position={[0, 0.5, 0]} color="#ffd98a" intensity={2.2} distance={0} decay={0} castShadow={false} />}
      </group>

      {/* a "window" on the back wall: an emissive pane (blooms into a bright window) + a RectAreaLight
          giving a soft, directional cool-daylight area fill — the realism stack's area-light layer.
          (App wiring of real window openings is a follow-on co-tune with E/A.) */}
      <mesh position={[1.0, 1.35, -RD / 2 + 0.03]}>
        <planeGeometry args={[1.4, 1.2]} />
        <meshStandardMaterial
          color="#eaf2ff"
          emissive="#cfe0ff"
          emissiveIntensity={0.5}
          roughness={1}
          metalness={0}
          side={THREE.DoubleSide}
        />
      </mesh>
      <AreaLight position={[1.0, 1.35, -RD / 2 + 0.1]} target={[0, 1.0, 0]} width={1.4} height={1.2} color="#cfe0ff" intensity={4} />

      {/* E-like default lights — the RealismLayer enhances these (it does NOT replace them). */}
      <hemisphereLight color="#ffffff" groundColor="#cfcbc2" intensity={0.85} />
      <ambientLight intensity={0.32} />
      <directionalLight
        position={[7, 13, 8]}
        intensity={1.35}
        color="#fff6e8"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      >
        <orthographicCamera attach="shadow-camera" args={[-8, 8, 8, -8, 0.5, 48]} />
      </directionalLight>

      {/* ceiling bulb: point light + a small emissive sphere fixture (blooms) — also `bulbsOn`-coupled */}
      {bulbsOn && <pointLight position={[0, WH - 0.2, 0]} color="#fff1e0" intensity={1.4} distance={0} decay={0} castShadow={false} />}
      <mesh position={[0, WH - 0.12, 0]}>
        <sphereGeometry args={[0.075, 16, 16]} />
        <meshStandardMaterial color="#ffffff" emissive="#fff1e0" emissiveIntensity={bulbsOn ? 0.6 : 0} roughness={1} metalness={0} />
      </mesh>
    </group>
  )
}
