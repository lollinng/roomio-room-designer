# Agent E — Lighting & Time-of-Day · PROGRESS

Domain: lighting. Code in `/lighting`. Contract: `shared/lighting_schema.json` (v1.0).
Renderer: **R3F** (three 0.169). World units: **meters**. Sun driven by the time bar (no real geo).

## Milestones

- [x] **E0 — Onboard & scaffold.** DONE. Onboarded; schema in /shared; LEARNINGS bootstrapped;
  renderer confirmed (R3F); A/C/B pinged. 19 pure unit tests green.
- [x] **E1 — Default room lights.** DONE + verified. `createDefaultRoomLights` auto-adds ambient
  hemisphere fill + warm ceiling task light per room (`store.ensureRoom`). Editable via
  `LightEditor` (intensity/enable/delete/add-accent) + warm/neutral/cool swatches. No dark box
  (harness mean luma 163 at noon). Screenshots: verify-out/01-noon.png.
- [x] **E2 — Layered lighting.** DONE on E side. ambient + task (+accent) layers; `contract.ts`
  `roomLightingSatisfaction()` predicate ⇒ default room is `{hasLight:true, isLayered:true}`
  (defaults.test.ts). **Pending A** wiring the predicate into the suggestion engine (requested).
- [x] **E3 — Sun + soft shadows.** DONE + verified. `Sun.tsx` = one DirectionalLight, PCFSoft
  (Canvas `shadows`), ortho frustum sized to house + 3 m, bias -0.0004 / normalBias 0.02; clean
  soft shadows, no acne/peter-panning. Tuned values logged in LEARNINGS.md.
- [x] **E4 — Time bar.** DONE + verified. `TimeBar` scrubs `timeOfDay`; sun arcs, shadows sweep
  (25% pixels change 0.25→0.75), warms+dims toward night (dawn mean < noon).
- [x] **E5 — North indicator.** DONE + verified. `NorthIndicator` rotate (±15°/slider) offsets
  azimuth (36% change at 90°), Reverse flips 180° (20% change). Bar + sign toggle independently
  (`LightingControls`); hiding both still renders (mean 163). Default state bar/north off in app.
- [x] **E6 — Multi-room + performance.** DONE + verified. `<LightingRig>` iterates rooms[]; ONE
  global hemisphere + ONE sun (the only shadow caster); room lights `castShadow=false`. `perf.ts`
  invariant: shadow-caster count = 1 regardless of room count (1→30 rooms; multiroom.test.ts).
  2-room harness (`?multi=1`) renders both rooms lit per-room under one sun — verify-out/08-multiroom.png.

## ✅ Acceptance (brief §8) — all met
Furnished room already lit (no dark box) ✓ · editable default light ✓ · warm feels cozier ✓ ·
sun → clean soft shadows ✓ · scrub time bar → sun arcs, shadows sweep, warms at low angle ✓ ·
rotate north → sun swings, reverse flips ✓ · hide controls → still renders ✓ · multi-room lit
per-room, framerate holds (1 shadow caster) ✓. **Verify: `node scripts/verify.mjs` (10/10) +
`npx vitest run` (24/24).** Remaining cross-agent item: A wires `roomLightingSatisfaction` into
the suggestion engine (E2 contract, requested in roomio.txt) + A mounts `<LightingRig>` in RoomView.

## Architecture decisions
- Same seam pattern as Agent B/C: A owns `RoomView.tsx` and its `<Lights>`; I cannot edit it.
  So I build a **drop-in R3F lighting library** (`<LightingRig>` + UI overlays) + a **faithful
  standalone harness** (a furnished room) to RUN and verify, and request A mount the rig (replace
  `<Lights>`) + the time-bar/north overlay. Until wired, the harness proves it end-to-end.
- Pure, testable cores: `sun.ts` (time→sun pos/intensity/color), `colorTemp.ts` (Kelvin→RGB),
  `defaults.ts` (room→default layered Light[]), `contract.ts` (A's layered-rule predicate).
- Verify like the team: vitest unit tests + headless puppeteer screenshot of the harness.

## Status log
- 2026-06-30: E0 started. Scaffolded /lighting (port 5186), published lighting_schema.json v1.0,
  bootstrapped shared/LEARNINGS.md (renderer facts), posted onboarding + requests to A/C/B.
