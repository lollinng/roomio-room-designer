# Agent G — Realistic Rendering · PROGRESS

Domain: make Roomio **look photographic** the way real-time WebGL actually does — PBR
materials + HDR image-based lighting + ACESFilmic tone mapping + ambient occlusion +
emissive bulbs with bloom + area lights — layered ON TOP of Agent E's lighting. Optional
stretch: a static-camera progressive path-traced "hero" still. **Not** a real-time ray tracer.

- Code lives in `/rendering` only. Other writable: `/shared`, `source/roomio.txt`, `shared/LEARNINGS.md`.
- Renderer is **React-Three-Fiber** (three ^0.169, fiber ^8.17, drei ^9.114) — the brief's
  vanilla-Three.js snippets are adapted to R3F.
- Contract: `shared/render_schema.json` (v1.0).
- Agent D merges; I commit only my own paths.

## Seam with E (settled — see roomio.txt onboarding entry)

E owns the **lights** (hemisphere/ambient fill, per-room task/accent, the sun + shadow config).
G owns how they **look** (materials, IBL, tone mapping, post-FX, emissive fixtures + bloom).
The app `<Canvas shadows flat>` is unchanged: `shadows` (PCFSoftShadowMap) = E; `flat`
(NoToneMapping) is KEPT so G's EffectComposer owns ACESFilmic + sRGB output (no double
tone-mapping). G's whole layer mounts as `<Canvas>` children (IBL + EffectComposer) — **zero
Canvas-prop changes**. G does NOT touch E's light units; ACESFilmic's apparent-brightness
shift is compensated by G's tone-mapping `exposure` (co-tuned with E, recorded in LEARNINGS.md).

## Milestones

| ID | Deliverable | Status |
|----|-------------|--------|
| **G0** | Read roomio.txt + LEARNINGS.md; scaffold `/rendering`; settle renderer/light seam with E; publish render schema; onboarding entry | ✅ done |
| **G1** | PBR materials + IBL env map + ACESFilmic tone mapping + sRGB | ✅ done (harness) |
| **G2** | Ambient occlusion (N8AO) + soft-shadow integration (with E) | ✅ done (harness) |
| **G3** | Emissive bulbs + bloom + correct falloff + area lights | 🟡 bulbs+bloom done; area lights (window/panel RectAreaLight) pending |
| **G4** | Quality toggle (high/medium/low) + RenderControls panel | ✅ done (harness) |
| **G5** | Optional: progressive path-traced hero render + export hook (with B/C) | ⬜ |
| **GA** | App mount (RealismLayer into RoomView) — handed to D/A via INTEGRATION.md | ⬜ awaiting D/E |

### Tuned working values (furnished harness, SwiftShader headless, 2026-07-01)
| Param | Value | Notes |
|---|---|---|
| tone mapping | ACES_FILMIC (post `<ToneMapping>` effect, renderer stays NoToneMapping) | composer owns it; `flat` Canvas kept |
| exposure | 1.0 default (slider 0.5–2.0) | custom pre-ACES linear-multiply Effect; compensates ACES midtone roll-off without touching E's lights |
| ibl.intensity (scene.environmentIntensity) | 0.55 | procedural Lightformer env (no CDN); modest so it doesn't double E's ambient fill |
| material envMapIntensity | 1.0 (per-material) | global dial is environmentIntensity; the two multiply |
| bloom | threshold 1.0, strength 0.85 (high), radius 0.65, mipmapBlur | selective via HDR emissive, not by lowering threshold (no room haze) |
| emissive boost | ×8 (MaterialEnhancer) | lifts A's authored emissive (0.35–0.45) above the 1.0 bloom threshold so bulbs/screens glow |
| N8AO | aoRadius 1.0, intensity 2.5, distanceFalloff 1, halfRes off(high)/on(med) | off entirely at 'low' |
| multisampling | 4 (high) / 2 (medium) / 0 (low) | MSAA on the HalfFloat composer target |

## Acceptance (from the brief)

A furnished room renders with PBR + HDR-IBL + filmic tone mapping + soft contact shadows/AO +
bulbs that glow with a soft bloom halo — **clearly more photographic than the flat baseline**,
side by side. Toggling a bulb (E's control) changes both light and glow. Switching quality to
"low" drops post-FX and holds framerate. Optionally, a static-camera "Render beauty shot"
progressively produces an exportable path-traced still that falls back to real-time on move.
No real-time ray tracer; renderer ownership with E is clean.

## Log

- **G0 (2026-07-01)** — Onboarded: read brief (11pp), full `roomio.txt` (1127 lines),
  `LEARNINGS.md`. Mapped the seam from `src/three/RoomView.tsx` (the `<Canvas>` config) +
  E's rig (`lighting/src/r3f/{LightingRig,Sun,RoomLights,Ceiling}.tsx`). Published
  `shared/render_schema.json` (v1.0). Ran an understanding workflow (materials audit + island
  conventions + R3F realism integration research) to pin exact dep versions before scaffolding.
- **G1–G4 (2026-07-01)** — Scaffolded the `/rendering` island (port 5188, own pkg/vite/tsconfig/
  vitest, matching house conventions). Built the drop-in: `IBL` (procedural Lightformer env →
  scene.environment, no CDN), `MaterialEnhancer` (runtime envMapIntensity + emissive boost, no
  A-source edits), `ExposureEffect` (custom pre-ACES exposure), `RealismPost` (EffectComposer:
  N8AO → Bloom → Exposure → ACES ToneMapping), `RealismLayer` (the single drop-in), `RenderControls`
  (quality/exposure/IBL panel), a render-settings store + quality presets (13 unit tests). Standalone
  furnished-room harness + headless verify (`scripts/verify.mjs`): 9/9 checks green in SwiftShader,
  realism vs flat-baseline diff 25.5%, no console errors. **Visually confirmed** (verify-out/):
  chrome sphere reflects the IBL env (flat = dead-black blob), walls filmic-rolled-off, soft contact
  AO, lamp + ceiling bulb glow with bloom — clearly more photographic than the flat baseline. "low"
  quality drops AO/MSAA but keeps the IBL+ACES foundation. typecheck clean.
- Published `rendering/INTEGRATION.md` (the exact 1-component app-mount diff for D/A). Posted the seam
  REQUEST → AGENT-E + REQUESTs → A/H/B in roomio.txt; recorded tuned values + seam ownership in
  shared/LEARNINGS.md. Next: G3 area lights (window/panel RectAreaLight) + G5 hero path-trace; adversarial
  review of the rig; coordinate the app mount with D/E.
