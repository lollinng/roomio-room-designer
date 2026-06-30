/**
 * Agent H — Photo-Texture Mapping. Public barrel for the drop-in library.
 * Pure pipeline (T1 detect+crop, T2 texture-ify) lands in H1–H3; the R3F apply layer
 * (H4) + persistence (H5) follow. See PROGRESS.md.
 */
export * from './contract'

// T1 detect+crop (reuses Agent B's bbox; client-side crop)
export * from './pipeline/crop'
// T2 texture-ify
export * from './pipeline/tile'
export * from './pipeline/delight'
export * from './pipeline/pbr'
// shared utilities
export * from './pipeline/image'
export * from './pipeline/tiling'
export * from './pipeline/sha256'

// H5 persistence: content-addressed asset store (references, not bytes)
export * from './store/assetStore'
