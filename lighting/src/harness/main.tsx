import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Scene } from './Scene'
import { LightingControls } from '../ui/LightingControls'
import { useLighting } from '../store'

// Expose the store for the headless verify script (harness only).
;(window as unknown as { __lighting: typeof useLighting }).__lighting = useLighting

function App() {
  // Every room gets sensible default lights the moment it exists (Pillar 1 / L-1).
  useEffect(() => {
    useLighting.getState().ensureRoom({ id: 'r_demo', centerM: [0, 0], wallHeightM: 2.7 })
    // Default the controls on so the harness shows them; the app would default bar/north off.
    useLighting.getState().toggleBar(true)
    useLighting.getState().toggleNorth(true)
  }, [])

  return (
    <>
      <Canvas
        shadows
        flat
        dpr={[1, 2]}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        camera={{ position: [4.2, 3.4, 5.2], fov: 40, near: 0.1, far: 200 }}
      >
        <color attach="background" args={['#cdccc9']} />
        <Scene />
        <OrbitControls
          makeDefault
          target={[0, 0.8, 0]}
          enableDamping
          maxPolarAngle={Math.PI / 2.05}
        />
      </Canvas>
      <LightingControls roomId="r_demo" />
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
