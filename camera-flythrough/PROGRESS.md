# Camera Flythrough — Progress (Agent B, work-stream 2)

Client-side Three.js virtual camera + flythrough for Roomio. **Not NeRF** — the
scene is synthetic Three.js geometry; this is real-time engine work.

Milestones map to the brief (§9). Each is independently testable.

| Milestone | Deliverable | Status |
|-----------|-------------|--------|
| **C0** | Scaffold `/camera-flythrough`; confirm A's renderer (R3F); publish `camera_path_schema.json` + `scene_contract.json`; log intent + scene-mount request | ✅ done |
| **C1** | F1 first-person walk + collision (PointerLockControls, WASD, ~1.6 m eye, wall+furniture footprint blocking) | ✅ done |
| **C2** | F2 top-down director view + camera gizmo + one-tap POV toggle | ✅ done |
| **C3** | F3 waypoint spline authoring (raycast floor, CatmullRomCurve3, draggable, per-point look-at + timing) | ✅ done |
| **C4** | F5 playback along path (getPointAt + look-ahead, play/pause/scrub, previewable POV) | ⬜ todo |
| **C5** | F6 frame-by-frame video export (canvas-record / WebCodecs, deterministic step loop, MP4 download) | ⬜ todo |
| **C6** | F4 walk-and-record path + JSON save/reload + polish | ⬜ todo |

## Renderer fact (C0)
Agent A's app is **React Three Fiber** (`@react-three/fiber` ^8 + `@react-three/drei` ^9,
`three` ^0.169). Canvas/camera/OrbitControls live in `src/three/RoomView.tsx`. World
units = meters, room centered on bbox center (`src/three/coords.ts`). `preserveDrawingBuffer`
is already enabled on the GL context — good for frame capture. There is already a decoupling
"bus" precedent: `src/three/cameraBus.ts`.

## Integration seam
The engine attaches to the **live scene** via `/shared/scene_contract.json` — a `SceneHandle`
published by a `sceneBus` that Agent A adds (mirroring `cameraBus.ts`). Until that lands, the
engine is developed + verified against a **faithful local harness** (`src/harness/`) that
implements the same `SceneHandle` over a furnished room using the same presets/collision/coords
math, so the engine drops onto the real scene with no API change. Requested from Agent A in
`source/roomio.txt`.

## Architecture
```
src/
  contract/        SceneHandle + CameraPath TS mirrors of the /shared schemas
  engine/          framework-agnostic Three.js modules (F1–F6), attach to a SceneHandle
  harness/         standalone dev bench: furnished room implementing SceneHandle + UI
tests/             vitest for pure logic (collision, curve sampling, decimation, path IO)
```

## Decisions log
- **C0** Path stored in **world meters** (camera consumes directly; room only recenters on
  shape change). Collision in **design cm** (reuses the front-end's exact footprint math).
- **C0** Video capture via **canvas-record (WebCodecs)** per brief; deterministic step loop, no
  MediaRecorder/captureStream. CCapture.js legacy fallback only.
