import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PBR_CONVENTIONS } from '../contract'

/**
 * Standalone demo harness for Agent H's photo-texture-mapping system.
 * H0 ships the scaffold + contract; the interactive pipeline (crop → texture-ify →
 * apply with preview/accept/revert) lands across H1–H5 (see PROGRESS.md).
 */
function App() {
  return (
    <div style={{ padding: 24, maxWidth: 720, color: '#222' }}>
      <h1 style={{ marginBottom: 4 }}>Roomio — Photo Texture Mapping</h1>
      <p style={{ color: '#666', marginTop: 0 }}>Agent H harness · port 5188</p>
      <p>
        Take a furniture photo → detect+crop its surface (via Agent B) → seamless, de-lit
        tiling PBR material (albedo + roughness + normal) → applied to the matching
        archetype's material slot with world-space tiling.
      </p>
      <p style={{ color: '#666' }}>
        H0 scaffold is live. Published contract: <code>shared/texture_schema.json</code> +{' '}
        <code>shared/pbr_conventions.json</code>. PBR color space — albedo:{' '}
        <b>{PBR_CONVENTIONS.colorSpace.albedo}</b>, roughness/normal:{' '}
        <b>{PBR_CONVENTIONS.colorSpace.roughness}</b>. See PROGRESS.md for H1–H5.
      </p>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
