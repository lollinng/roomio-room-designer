# Agent E — Lighting & Time-of-Day · PROGRESS

Domain: lighting. Code in `/lighting`. Contract: `shared/lighting_schema.json` (v1.0).
Renderer: **R3F** (three 0.169). World units: **meters**. Sun driven by the time bar (no real geo).

## Milestones

- [~] **E0 — Onboard & scaffold.** Read brief + roomio.txt + LEARNINGS; post onboarding;
  scaffold `/lighting`; publish `shared/lighting_schema.json`; bootstrap `shared/LEARNINGS.md`;
  confirm renderer (R3F ✓); ping A (layered-rule contract + seam), C (per-room + windows), B (camera).
  - DoD: onboarded; schema in /shared; A/C pinged. **(in progress)**
- [ ] **E1 — Default room lights.** Auto ceiling (task) + ambient/hemisphere fill per room;
  editable (move/recolor/intensity/delete/swap); warm/cool color-temperature. No dark box.
- [ ] **E2 — Layered lighting.** ambient + task + accent; satisfies A's "needs layered lighting"
  rule on a default room (via `roomLightingSatisfaction` predicate, pending A wiring).
- [ ] **E3 — Sun + soft shadows.** One DirectionalLight; PCFSoft; ortho frustum encloses house;
  bias/normalBias tuned against a furnished room; values logged to LEARNINGS.md.
- [ ] **E4 — Time bar.** Toggleable bar drives sun arc + intensity/warmth shift; shadows sweep.
- [ ] **E5 — North indicator.** Rotate offsets azimuth; reverse flips 180°; bar + sign toggle
  independently; pleasant default angle on load.
- [ ] **E6 — Multi-room + performance.** House-wide per-room lighting; sun = primary shadow caster;
  framerate holds; cleanup.

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
