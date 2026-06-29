import { Suspense, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, ContactShadows } from '@react-three/drei'
import { useStore } from '../store'
import { bbox } from '../geometry/walls'
import { Room } from './Room'
import { EditHandles } from './EditHandles'
import { OpeningEditor } from './OpeningEditor'
import { FurnitureEditor } from './FurnitureEditor'
import { setViewCapturer } from './cameraBus'
import { SceneBridge, FlythroughHud } from './Flythrough'
import type { FlythroughController } from '../../camera-flythrough/src/engine/FlythroughController'
import type { CameraView } from '../types'

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

type ControlsLike = {
  target: { set: (x: number, y: number, z: number) => void; toArray: () => number[] }
  update: () => void
} | null

/**
 * Refit the camera on shape change / fitNonce bump. If the loaded design carries
 * a saved view (set when the user pressed Save), restore that exact viewpoint so
 * reopening a previous state looks identical; otherwise frame the room by default.
 */
function CameraFit() {
  const shape = useStore((s) => s.design.shape)
  const fitNonce = useStore((s) => s.fitNonce)
  const { camera, controls } = useThree()
  useEffect(() => {
    const c = controls as unknown as ControlsLike
    const saved = useStore.getState().design.view
    if (saved) {
      camera.position.set(saved.cam[0], saved.cam[1], saved.cam[2])
      camera.updateProjectionMatrix()
      if (c?.target) {
        c.target.set(saved.target[0], saved.target[1], saved.target[2])
        c.update()
      }
      return
    }
    const b = bbox(useStore.getState().design.corners)
    const r = Math.max(b.w, b.d, 300) / 100
    const dist = r * 1.45
    camera.position.set(dist * 0.62, dist * 0.72, dist * 0.8)
    camera.updateProjectionMatrix()
    if (c?.target) {
      c.target.set(0, 0.7, 0)
      c.update()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shape, fitNonce])
  return null
}

/** Registers a capturer so the UI can read the current camera view at save time. */
function ViewCapturer() {
  const { camera, controls } = useThree()
  useEffect(() => {
    setViewCapturer((): CameraView | null => {
      const c = controls as unknown as ControlsLike
      const t = c?.target?.toArray?.() ?? [0, 0.7, 0]
      return {
        cam: [camera.position.x, camera.position.y, camera.position.z],
        target: [t[0], t[1], t[2]],
      }
    })
    return () => setViewCapturer(() => null)
  }, [camera, controls])
  return null
}

export function RoomView({ children }: { children?: ReactNode }) {
  const corners = useStore((s) => s.design.corners)
  const stage = useStore((s) => s.stage)
  const [flyController, setFlyController] = useState<FlythroughController | null>(null)
  const { camPos, radius } = useMemo(() => {
    const b = bbox(corners)
    const r = Math.max(b.w, b.d, 300) / 100
    return {
      camPos: [r * 0.62, r * 0.72, r * 0.8] as [number, number, number],
      radius: r,
    }
  }, [corners])

  return (
    <>
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
      <ViewCapturer />
      <SceneBridge onController={setFlyController} />
    </Canvas>
    <FlythroughHud controller={flyController} />
    </>
  )
}
