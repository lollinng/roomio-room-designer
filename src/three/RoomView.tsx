import { Suspense, useEffect, useMemo, type ReactNode } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
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
      <hemisphereLight args={['#ffffff', '#cfcbc2', 1.05]} />
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[7, 13, 8]}
        intensity={1.35}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        shadow-camera-near={0.5}
        shadow-camera-far={48}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[-9, 7, -7]} intensity={0.45} />
      <directionalLight position={[0, 6, -12]} intensity={0.25} />
    </>
  )
}

/** Refit the camera when the room shape changes (not on furniture/dimension edits). */
function CameraFit() {
  const shape = useStore((s) => s.design.shape)
  const { camera, controls } = useThree()
  useEffect(() => {
    const b = bbox(useStore.getState().design.corners)
    const r = Math.max(b.w, b.d, 300) / 100
    const dist = r * 1.45
    camera.position.set(dist * 0.62, dist * 0.72, dist * 0.8)
    camera.updateProjectionMatrix()
    const c = controls as unknown as { target: { set: (x: number, y: number, z: number) => void }; update: () => void } | null
    if (c?.target) {
      c.target.set(0, 0.7, 0)
      c.update()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shape])
  return null
}

export function RoomView({ children }: { children?: ReactNode }) {
  const corners = useStore((s) => s.design.corners)
  const stage = useStore((s) => s.stage)
  const { camPos, radius } = useMemo(() => {
    const b = bbox(corners)
    const r = Math.max(b.w, b.d, 300) / 100
    return {
      camPos: [r * 0.62, r * 0.72, r * 0.8] as [number, number, number],
      radius: r,
    }
  }, [corners])

  return (
    <Canvas
      shadows
      flat
      dpr={[1, 2]}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      camera={{ position: camPos, fov: 40, near: 0.1, far: 200 }}
    >
      <color attach="background" args={['#cdccc9']} />
      <Lights />
      <Suspense fallback={null}>
        <Room />
        {stage === 'step2' && <EditHandles />}
        {stage === 'step3' && <OpeningEditor />}
        {stage === 'furnish' && <FurnitureEditor />}
        {children}
        <ContactShadows
          position={[0, 0.002, 0]}
          scale={radius * 4.2}
          resolution={1024}
          blur={2.6}
          opacity={0.38}
          far={6}
        />
      </Suspense>
      <OrbitControls
        makeDefault
        target={[0, 0.7, 0]}
        enablePan
        minDistance={radius * 0.45}
        maxDistance={radius * 4.5}
        maxPolarAngle={Math.PI / 2.05}
        enableDamping
        dampingFactor={0.13}
      />
      <CameraFit />
    </Canvas>
  )
}
