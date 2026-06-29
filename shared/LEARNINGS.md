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

### VERIFIED working values (furnished 4×5 m room, headless swiftshader, 2026-06-30)
These produce a lit room with clean soft shadows, **no acne, no peter-panning** at room scale
(screenshots: `/lighting/verify-out/`). Tune up for big houses (see notes).
| Param | Verified value |
|---|---|
| sun base intensity (noon) | **1.35** (legacy units) × `max(0,sin(time·π))` × intensityScale |
| hemisphere fill | sky `#ffffff` / ground `#cfcbc2`, intensity **0.7** |
| scene ambient fill | **0.22** (so shadowed faces aren't black) |
| ceiling task (per room) | **0.8**, warm `#ffd6aa` (2700K) |
| shadow.mapSize | **2048** (room scale; bump to 4096 for multi-room house) |
| shadow.bias | **-0.0004** |
| shadow.normalBias | **0.02** |
| shadow ortho half-extent | **max(houseHalfW, houseHalfD) + 3 m** margin |
| shadow.camera.far | **domeRadius + half·2 + 5** (encloses sun→house) |
| sun.domeRadiusM | **30** |

### Gotchas confirmed
- DirectionalLight aims `position → target`; rotating it does nothing. The default target is at
  the origin (0,0,0) = room/house center, so aiming the sun = just setting `position`; no target
  object needed as long as everything is centered on the bbox (it is, per coords.ts).
- **R3F shadow-camera gotcha:** changing `shadow-camera-left/right/top/bottom`/`far` via JSX props
  does NOT auto-call `updateProjectionMatrix()`. Set them imperatively in a `useEffect` (grab the
  light ref, mutate `light.shadow.camera.*`, call `cam.updateProjectionMatrix()`, set
  `light.shadow.needsUpdate = true`). See `/lighting/src/r3f/Sun.tsx`.
- Sun position from time: `elev = sin(time·π)·maxElevRad`, `az = (time·π) − π/2 + northOffset`;
  `pos = r·[cos(elev)·sin(az), sin(elev), cos(elev)·cos(az)]`. maxElevation is stored in DEGREES
  (`maxElevationDeg`) and converted to radians internally. Pure fn — `/lighting/src/sun.ts`.
- **Performance:** the sun is the ONLY shadow-casting light; per-room ceiling/accent lights are
  `castShadow=false`. Ambient is ONE global hemisphere (not stacked per-room) so an N-room house
  doesn't over-brighten or pay for N hemisphere lights. `<LightingRig>` enforces this.
- Background `#cdccc9` is bright (~luma 203); a "dark box" failure shows as low mean luminance.
  The default rig yields mean ~163 at noon (lit) with ~7–8% dark pixels (shadows present).

---

## Persistence & Sharing (Agent C, feature 2)

Code in `/persistence`. Contract: `shared/save_envelope_schema.json` (v1.0).

### The save envelope (one design = one envelope = one `.roomio` file)
- Composes the FULL scene with NO redundancy:
  - `scene.house` = Agent C's House (`shared/house_schema.json`) — **already embeds Agent A's
    RoomDesign** at `rooms[].interior`. So "interiors" are NOT a sibling key; they live inside the house.
  - `scene.lighting` = Agent E's LightingState (`shared/lighting_schema.json`), keyed by room_id.
    `null` => E renders its defaults. Persistence treats lighting as an **opaque pass-through**
    (stored + returned byte-for-byte; unknown/future fields survive a round-trip).
  - `+ design_id, name, createdAt, updatedAt, rev (monotonic), thumbnail, share{access,view_link_id,edit_link_id}`.
- **Backward compat is mandatory + already handled** in `persistence/src/envelope/migrate.ts`:
  a bare RoomDesign (today's single-room save), a bare House, and A's localStorage design-map
  `{ [id]: RoomDesign }` all migrate forward into the envelope. `migrateToEnvelope(json)` is the
  single load/import entry; returns null (never throws) on junk.

### Storage tier — DECISION (ratify @AGENT-D)
- **LOCAL-FIRST now**, cloud accounts + live share URLs as a scoped follow-on.
- A's `src/repository.ts` already routes *RoomDesign* saves cloud-when-authed / localStorage-when-guest.
  Persistence works one level UP at the *envelope* level, behind a backend-agnostic `StorageAdapter`:
  localStorage/in-memory adapter ships now; a server-envelope adapter slots into the same interface later.
- **"Share link" in this tier** = (a) `.roomio` file export/import, (b) static view-only **showcase**
  export (read-only walkthrough of ONE design, reuses B's flythrough). Live URLs are the upgrade.
- **localStorage trap (brief s7):** the adapter degrades to in-memory when localStorage is unavailable
  (artifact/preview/incognito-quota) and NEVER silently drops — surfaced as a save-status error + retry.

### Gotchas
- `/persistence` mirrors A's RoomDesign + C's House types **read-only** in `src/scene/slices.ts`
  (same zero-build-coupling convention B/C/E use). Source of truth stays `src/types.ts` (A) /
  `multi-room/src/types.ts` (C) / `shared/lighting_schema.json` (E). House coercion in
  `src/scene/coerce.ts` is a read-only port of `multi-room/src/persistence.ts` — **re-sync if C's
  house coercion changes materially.**
- Showcase MUST be a separate entry point that only receives one design's envelope — never imports the
  store/library. Cardinal sin = a view link reaching the editor. Design defensively (own HTML entry).
