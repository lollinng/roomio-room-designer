# Roomio — Shared LEARNINGS

Hard-won, cross-agent codebase facts. **Agent D curates this**; any agent may append a
dated note under their own section. Read this at the start of every cycle. Keep entries
terse and factual — values others (and future-you) should not have to re-derive.

> Bootstrapped by **Agent E** on 2026-06-30 because no LEARNINGS.md existed yet, though the
> briefs reference it. Agent D: please fold/curate as you see fit.

---

## Renderer & world units (CONFIRMED — applies to everyone)

- **Renderer is React-Three-Fiber**, NOT plain Three.js. Deps: `three ^0.169.0`,
  `@react-three/fiber ^8.17`, `@react-three/drei ^9.114`. (Confirmed by Agent B from the
  repo, roomio.txt line ~204; re-confirmed by Agent E reading `src/three/RoomView.tsx`.)
- **World units are METERS.** Design space is centimeters; `src/three/coords.ts` `makeFrame()`
  converts cm→m and centers the room on its bounding-box center (`toWorld = (x-cx)/100`).
- `<Canvas shadows flat ...>` in `src/three/RoomView.tsx`:
  - `shadows` (bare) ⇒ `THREE.PCFSoftShadowMap` (soft edges) — good default for the sun.
  - `flat` ⇒ `THREE.NoToneMapping`. So colors are rendered ~as authored; intensities are
    **legacy (non-physical) units**, not physically-based watts. Tune intensities to THIS
    renderer; do not copy physically-based-units tutorials.
  - `gl={{ preserveDrawingBuffer: true }}` already set (Agent B needs it for frame capture).
  - `camera`: fov 40, near 0.1, far 200.
- A's existing baseline lights (`Lights()` in RoomView.tsx) — a working reference at room scale:
  - `hemisphereLight('#ffffff','#cfcbc2', 1.05)` (ambient fill)
  - `ambientLight(0.55)`
  - `directionalLight` (sun): `position=[7,13,8]`, `intensity=1.35`, `castShadow`,
    `shadow-mapSize 2048`, ortho `left/right/top/bottom = ±14`, `near 0.5`, `far 48`,
    `bias -0.0004`. Two dim fill directionals (0.45, 0.25), no shadow.
  - `<ContactShadows>` (drei) under furniture: `scale ≈ radius*4.2`, `blur 2.6`, `opacity 0.38`, `far 6`.
- Scene background color: `#cdccc9`.

---

## Lighting & Time-of-Day (Agent E)

Code in `/lighting`. Contract: `shared/lighting_schema.json` (v1.0). Schema units = meters.

### Tuned shadow / intensity values (room scale ≈ 3–6 m; UPDATE as tuned against furnished rooms)
| Param | Working value | Notes |
|---|---|---|
| sun.intensity (noon) | ~1.35 (legacy units) | matches A's baseline directional; scaled by `max(0, sin(time·π))` |
| shadow.mapSize | 2048 | 4096 only for large multi-room houses |
| shadow.bias | -0.0004 | A's working value; small negative kills acne. Pair with normalBias. |
| shadow.normalBias | 0.02 | preferred for angled/curved surfaces |
| shadow ortho half-extent | houseHalf + ~3 m margin | MUST enclose whole house or shadows clip; too big ⇒ coarse |
| shadow.camera.far | ≥ domeRadius + houseDiag | encloses sun→house |
| hemisphere fill | sky `#ffffff` / ground `#cfcbc2`, intensity ~0.6–1.0 | so shadows aren't pure black |
| ambient fill | ~0.3–0.55 | keep low; hemisphere does most fill |
| ceiling task (per room) | ~0.6–0.9 | warm `#fff1e0` (~2700K) default cozy |

### Color temperature presets (Kelvin → used for warm/cool toggle)
- warm ≈ 2700K (`#ffd6aa`-ish tint), neutral ≈ 4000K, cool ≈ 5000K (`#dce6ff`-ish).
- "Warm feels cozier" acceptance: warm ceiling + warmthShift sun at low angle.

### Gotchas confirmed
- DirectionalLight aims `position → target`; rotating it does nothing. `sun.target` must be
  added to the scene (in R3F: render the target object or set `.target.position` + update).
- Sun position from time: `elev = sin(time·π)·maxElev`, `az = (time·π) − π/2 + northOffset`;
  `pos = r·[cos(elev)·sin(az), sin(elev), cos(elev)·cos(az)]`. Pure fn — see `/lighting/src/sun.ts`.

_(Append tuned values here as they're measured against real furnished rooms.)_
