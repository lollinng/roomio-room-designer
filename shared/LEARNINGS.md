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

---

## Shared canonical lib `shared/lib/` (Agent F — QA/dedup)

**`shared/lib/math.ts` is the single source of truth for these pure scalar helpers — do NOT re-fork
them back into an island.** Import via a relative path:

```ts
import { clamp, clamp01, DEG2RAD } from '../../shared/lib/math'
```

| Export | Body | Was duplicated in (now imports) |
|---|---|---|
| `clamp(v, lo, hi)` | `v < lo ? lo : v > hi ? hi : v` (NaN passes through) | src/geometry/collision.ts (dead, deleted), lighting/src/colorTemp.ts |
| `clamp01(v)` | `v < 0 ? 0 : v > 1 ? 1 : v` (= `clamp(v,0,1)`) | lighting/src/sun.ts, multi-room/src/connectors.ts |
| `DEG2RAD` | `Math.PI / 180` | src/data/personas.ts, lighting/src/sun.ts |

- **This is the repo's first cross-island TS import.** It is proven to resolve under each island's
  **vitest AND tsc** even though `shared/lib` sits outside every island's `tsconfig include:["src"]`
  (`moduleResolution:"bundler"` pulls the imported leaf in transitively). Behavior is pinned by
  `shared/lib/math.test.ts`, **run by the ROOT vitest** (`vitest.config.ts` include adds
  `'shared/lib/**/*.test.ts'`). There is no package.json/vitest under `/shared` — root owns its tests.
- **Gotcha (`noUnusedLocals`):** lighting / multi-room / camera-flythrough set `noUnusedLocals:true`, so
  when you import a helper you MUST delete the local copy in the SAME edit, or tsc fails on the orphan.
- **NOT consolidated (deliberately distinct — leave alone):** `src/data/personas.ts` 4-arg
  `clamp(v,def,lo,hi)` (undefined-handling), `src/data/archetypes.ts` `clampAxis` (returns a tuple),
  and the Python `detection-pipeline` inline clamps. Same name, different behavior.
- **Still duplicated, NOT yet consolidated — pending Agent D ratification of cross-island coupling** (see
  roomio.txt DECISIONs D1–D3): the geometry bundle (`footprintCorners`, `polygonCentroid`,
  `pointInPolygon`, `dot2`, `obbAxes`/`obbOverlap`, `signedArea`, `pointOnWall`, full `bbox`,
  `buildWallParts`, the `OBB` type) and the type-guard bundle (`isObj`, `isFiniteNumber`, `looksLike*`).
  Once D ratifies, these become mechanical repeats of the math.ts pattern.
- **DIVERGENT across islands — must NOT be blindly merged** (each an owner decision, not a dedup):
  `uid` (3 different id FORMATS; ids are serialized → data contract), `coerceHouse`/`wrapSingleRoom`
  (impure `Date.now()`/timestamp semantics, pinned by migrate.test), `toWorld` room→house
  (`{x,z}` vs persistence `{x,y}` + missing rotation/NaN guard), `deriveWalls`, `makeFrame`,
  download helpers. See the Agent F catalogue in roomio.txt.

### Hard-won bugs (adversarial review of the autosave/storage layer — fix these patterns anywhere)
- **localStorage degrade must rehydrate.** A localStorage adapter that "falls back to in-memory" on a
  mid-session quota/availability throw will ORPHAN every design already on disk (reads route to an empty
  in-memory map -> the library looks wiped) unless `degrade()` copies all existing localStorage entries
  into the fallback BEFORE flipping, and is idempotent. Tested in adapter.test.ts.
- **Optimistic save reflection must not clobber a newer edit.** After an async save resolves, reflecting
  the just-saved envelope back into the live model wholesale will overwrite an edit the user made DURING
  the save (then a follow-on edit built on the stale base loses the intermediate edit permanently). Guard
  with an identity check: only fully reflect when `current.scene === justSaved.scene`; otherwise adopt
  only durable bookkeeping (rev/updatedAt) and keep the newer scene. Tested in session.test.ts.
- **Forward-compat round-trip.** If your contract says "unknown fields preserved," the loader must actually
  carry through unknown top-level keys and NOT downgrade a higher `schema_version`. Tested in migrate.test.ts.
- **One cap, one place.** Duplicated cap constants (history MAX in two files) drift; route load + runtime
  through the same `capHistory`.

### Sharing isolation + backward compat (Agent C, C2-4..C2-6)
- **Showcase isolation is an import-graph property, not a runtime check.** The view-only showcase is a
  SEPARATE entry (showcase.html → src/showcase/*) that imports ONLY a payload decoder + a self-contained
  3D scene — never the session/library/editor. Verified two ways: (1) opened in a fresh incognito context,
  it renders read-only with no editor chrome / edit controls / link back to index.html; (2) `vite build`
  emits a `showcase` chunk distinct from the editor `main` chunk. The shared payload/envelope code lives in
  a third chunk with no editor code.
- **Showcase payload = minimal projection.** A share link carries only `{ name, scene }` in the URL
  fragment (#s=base64). It DROPS design_id, share tokens, history, thumbnail — so a link cannot carry other
  designs even if downstream code were buggy. Fragment (not query) ⇒ never sent to a server.
- **Dependency-free PDF.** A real floor-plan `.pdf` is produced by embedding the rendered plan as a JPEG
  via the DCTDecode filter in a hand-built 6-object PDF (src/export/pdf.ts). Validated: `file` → "PDF 1.4,
  1 page", macOS Quartz renders it. ASCII-fold title text (Helvetica/StandardEncoding can't show em-dash/×).
- **Old saves migrate once, non-destructively.** A's pre-persistence `roomio.designs.v1` localStorage map
  is imported into the new envelope library on first run (src/storage/legacy.ts), guarded by a done-flag,
  never overwriting existing designs, never deleting the old key.
