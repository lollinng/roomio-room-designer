import { Suspense, useMemo, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, ContactShadows } from '@react-three/drei'
import { useStore } from '../store'
import { bbox } from '../geometry/walls'
import { Room } from './Room'
import { EditHandles } from './EditHandles'
import { OpeningEditor } from './OpeningEditor'
import { FurnitureEditor } from './FurnitureEditor'

function Lights() {
  return (
    <>
      <hemisphereLight args={['#ffffff', '#b9b6ae', 0.85]} />
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[6, 12, 8]}
        intensity={1.15}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-camera-near={0.5}
        shadow-camera-far={40}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[-8, 6, -6]} intensity={0.3} />
    </>
  )
}

export function RoomView({ children }: { children?: ReactNode }) {
  const corners = useStore((s) => s.design.corners)
  const stage = useStore((s) => s.stage)
  const { camPos, radius } = useMemo(() => {
    const b = bbox(corners)
    const r = Math.max(b.w, b.d) / 100
    return {
      camPos: [r * 0.95, r * 1.05, r * 1.15] as [number, number, number],
      radius: r,
    }
  }, [corners])

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      camera={{ position: camPos, fov: 38, near: 0.1, far: 200 }}
    >
      <color attach="background" args={['#cbcbca']} />
      <Lights />
      <Suspense fallback={null}>
        <Room />
        {stage === 'step2' && <EditHandles />}
        {stage === 'step3' && <OpeningEditor />}
        {stage === 'furnish' && <FurnitureEditor />}
        {children}
        <ContactShadows
          position={[0, 0.001, 0]}
          scale={radius * 4}
          resolution={1024}
          blur={2.4}
          opacity={0.42}
          far={6}
        />
      </Suspense>
      <OrbitControls
        makeDefault
        target={[0, 0.6, 0]}
        enablePan
        minDistance={radius * 0.5}
        maxDistance={radius * 4}
        maxPolarAngle={Math.PI / 2.05}
        enableDamping
        dampingFactor={0.12}
      />
    </Canvas>
  )
}
