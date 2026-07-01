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
import type { Camera } from 'three'
import type { CameraView } from '../types'
// Agent E lighting (drop-in): layered default room lights + directional sun + soft shadows,
// driven by the time bar / north controls. Replaces the old local <Lights>.
import { LightingRig } from '../../lighting/src/r3f/LightingRig'
import { Ceiling } from '../../lighting/src/r3f/Ceiling'
import { LightingControls } from '../../lighting/src/ui/LightingControls'
import { useLighting } from '../../lighting/src/store'
import { makeFrame } from './coords'
// Agent E multi-room "whole house" overview: render all session rooms together,
// interconnected, instead of editing one at a time. Toggle via useHouseView.
import { useHouse } from './houseSession'
import { useHouseView } from './houseViewMode'
import { HouseView } from './HouseView'
import { ColliderDebug } from './ColliderDebug'
import { layoutHouse, houseBoundsCm } from './houseLayout'
// Agent G realistic rendering (drop-in): PBR + HDR-IBL + ACESFilmic tone mapping + AO + emissive
// bulbs/bloom + area lights, layered ON TOP of E's lighting. Mounts as <Canvas> children (no Canvas-
// prop changes: `flat` is KEPT so the post EffectComposer owns tone mapping). RenderControls is the
// quality/exposure/beauty-shot panel. See rendering/INTEGRATION.md.
import { RealismLayer } from '../../rendering/src/r3f/RealismLayer'
import { RenderControls } from '../../rendering/src/ui/RenderControls'

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
  const designId = useStore((s) => s.design.id)
  const hasWindows = useStore((s) => s.design.openings.some((o) => o.kind === 'window'))
  const wallHeight = useStore((s) => s.design.wallHeight)
  const [flyController, setFlyController] = useState<FlythroughController | null>(null)
  // Pin OrbitControls to the ORIGINAL camera so drei never rebinds it to (and
  // clobbers) the flythrough's swapped-in cameras. Captured once on Canvas create.
  const [origCam, setOrigCam] = useState<Camera | null>(null)

  // Room polygon in world meters, for the ceiling/roof.
  const ceilingCorners = useMemo(() => {
    const f = makeFrame(corners)
    return corners.map((c) => f.toWorld(c.x, c.z) as [number, number])
  }, [corners])

  // Every room gets sensible default lights the moment it exists (Pillar 1: never a dark box).
  useEffect(() => {
    const d = useStore.getState().design
    useLighting.getState().ensureRoom({
      id: d.id,
      centerM: [0, 0], // room is centered on its bbox center (coords.ts)
      wallHeightM: d.wallHeight / 100,
    })
  }, [designId])

  const { camPos, radius } = useMemo(() => {
    const b = bbox(corners)
    const r = Math.max(b.w, b.d, 300) / 100
    return {
      camPos: [r * 0.62, r * 0.72, r * 0.8] as [number, number, number],
      radius: r,
    }
  }, [corners])

  // Whole-house overview mode: lay out all session rooms interconnected.
  const viewMode = useHouseView((s) => s.mode)
  const debugColliders = useHouseView((s) => s.debugColliders)
  const houseRooms = useHouse((s) => s.rooms)
  const activeId = useHouse((s) => s.activeId)
  const liveDesign = useStore((s) => s.design)
  const houseMode = viewMode === 'house' && houseRooms.length > 1
  const { placed, houseBounds } = useMemo(() => {
    if (!houseMode) return { placed: [], houseBounds: { w: 0, d: 0, cx: 0, cz: 0 } }
    const designs = houseRooms.map((r) => (r.id === activeId ? liveDesign : r.design))
    const p = layoutHouse(designs)
    return { placed: p, houseBounds: houseBoundsCm(p) }
  }, [houseMode, houseRooms, activeId, liveDesign])
  const viewRadius = houseMode ? Math.max(houseBounds.w, houseBounds.d, 300) / 100 : radius

  return (
    <>
    <Canvas
      shadows
      flat
      dpr={[1, 2]}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      camera={{ position: camPos, fov: 40, near: 0.1, far: 200 }}
      onCreated={(s) => setOrigCam(s.camera)}
    >
      <color attach="background" args={['#cdccc9']} />
      <RealismLayer />
      {houseMode ? (
        <Suspense fallback={null}>
          <HouseView placed={placed} bounds={houseBounds} />
          {children}
        </Suspense>
      ) : (
        <>
          <LightingRig houseHalfExtentM={radius / 2} activeRoomId={designId} />
          <Suspense fallback={null}>
            <Room />
            <Ceiling cornersWorld={ceilingCorners} heightM={wallHeight / 100} />
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
          <CameraFit />
        </>
      )}
      <ColliderDebug />
      <OrbitControls
        makeDefault
        camera={origCam ?? undefined}
        target={[0, 0.7, 0]}
        enablePan
        minDistance={viewRadius * 0.4}
        maxDistance={viewRadius * 5}
        maxPolarAngle={Math.PI / 2.05}
        enableDamping
        dampingFactor={0.13}
      />
      <ViewCapturer />
      <SceneBridge onController={setFlyController} />
    </Canvas>
    <FlythroughHud controller={flyController} />
    {/* anchorRightPx clears the .vp-tools view toolbar (right:18px + 40px wide ⇒ 58px)
        so the "💡 Light Mode" launcher/panel doesn't overlap the undo/redo/fit/home buttons. */}
    <LightingControls roomId={designId} hasWindows={hasWindows} anchorRightPx={66} />
    <RenderControls anchorLeftPx={452} anchorBottomPx={12} />
    {/* Whole-house / single-room toggle (only meaningful with 2+ rooms) + a
        collider-debug toggle (visualise the flythrough's collision footprints,
        to test for "invisible wall" bugs). */}
    {houseRooms.length > 1 && (
      <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 10, display: 'flex', gap: 8 }}>
        <button
          onClick={() => useHouseView.getState().toggle()}
          title={houseMode ? 'Back to editing one room' : 'See all rooms together as a connected house'}
          style={{
            padding: '8px 16px',
            borderRadius: 999,
            border: '1px solid rgba(0,0,0,0.12)',
            background: houseMode ? '#111' : '#fff',
            color: houseMode ? '#fff' : '#23211e',
            font: '13px ui-sans-serif, system-ui, sans-serif',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
          }}
        >
          {houseMode ? '🚪 Edit a room' : '🏠 View whole house'}
        </button>
        <button
          onClick={() => useHouseView.getState().toggleDebugColliders()}
          title="Show the flythrough collision footprints (wireframes) — to test for invisible-wall bugs"
          style={{
            padding: '8px 12px',
            borderRadius: 999,
            border: '1px solid rgba(0,0,0,0.12)',
            background: debugColliders ? '#ff2bd6' : '#fff',
            color: debugColliders ? '#fff' : '#23211e',
            font: '13px ui-sans-serif, system-ui, sans-serif',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
          }}
        >
          ▦ Colliders
        </button>
      </div>
    )}
    </>
  )
}
