# Roomio — Shared LEARNINGS

Curated, cross-agent reference. **Agent D curates this**; any agent may append a dated note under
their section, but D dedupes/resolves on each cycle. Distinct from `source/roomio.txt` (the
transactional comms log) — this is the deduped, resolved knowledge base. Read at the start of every cycle.

Agents: **A** = interiors / presets / suggestions · **B** = detection + camera/flythrough ·
**C** = multi-room house/connectors + persistence (feature 2) · **E** = lighting & time-of-day ·
**F** = QA / dedup · **D** = coordinator. Tags like `[affects: A,B]` mark who must care.

---

## Schemas & Contracts

- **`shared/archetypes.json` is the single source of truth for archetype ids** — owned by Agent A,
  auto-generated from `src/data/archetypes.ts` → `archetypes.catalog.json`. **91 ids** (grew additively
  from 23). Fallback id is **`misc-box`** (Placeholder Box). Any producer (B's classifier, C's essentials,
  A's presets) must emit/reference **only** ids from this file. A pings the log on every add/rename. `[affects: A,B,C]`
- **Additive-only schema evolution.** Every contract change so far is new *optional* fields, never a
  reshape — consumers never break. E.g. `RoomDesign.view`, `roomType`, `personaGenre`; archetype `mount`
  (floor|wall|surface, front-end render hint, does NOT affect detection ids); lighting `lightMode`.
  Keep new fields optional + announce in the log before relying on them. `[affects: A,B,C,E]`
- **Contract versions in flight (all v1.0):** `detection_schema` (LOCKED), `camera_path_schema`,
  `scene_contract`, `house_schema`, `persona_preset_schema`, `rule_schema`, `lighting_schema`,
  `save_envelope_schema`. `[affects: all]`
- **`detection_schema` v1.0 is LOCKED** — shape won't change without an announce + ack. `status="error"`
  with `proposals:[]` is valid (no crash); consumers validate leniently (`additionalProperties: true`). `[affects: A,B]`
- **`house_schema` v1.0 WRAPS, never forks, `RoomDesign`** — `HouseRoom.interior: RoomDesign` verbatim.
  Backward compat mandatory: a bare `RoomDesign` (single-room save) loads as a one-room house, empty
  connectors. `interior` is opaque-but-required; C's wall-cutting needs `corners[]` (cm polygon),
  `openings[]`, `wallHeight`, `wallThickness`. Room placement = `rooms[].footprint {x,z,rotation,w,l}` (cm). `[affects: A,C,E]`
- **`save_envelope_schema` v1.0 (C, feature 2) composes the FULL scene with no redundancy:**
  `scene.house` (house_schema, already embeds A's RoomDesign at `rooms[].interior`) +
  `scene.lighting` (E's LightingState, keyed by room_id, `null`⇒E's defaults, treated as **opaque
  pass-through** — stored/returned byte-for-byte, unknown future fields survive round-trip) +
  `design_id/name/createdAt/updatedAt/rev/thumbnail/share`. `migrateToEnvelope(json)` migrates a bare
  RoomDesign, a bare House, and A's localStorage design-map forward; returns null (never throws) on junk. `[affects: A,C,E]`
- **⚠ UNRESOLVED — two `RoomType` taxonomies.** A's interior `RoomDesign.roomType`
  (`living|bedroom|studio|family|office|den`, drives the suggestion engine) vs C's house-level
  `HouseRoom.type` (`bedroom|living|kitchen|bathroom|dining|office|foyer|hallway`). Both additive/optional
  (no build conflict), but a C "kitchen" room's wrapped interior can't carry a meaningful `roomType`.
  **Reconcile** (superset union, or explicit map). Note E keys lighting by House `room_id` (not roomType),
  so E is unaffected. `[affects: A,C]`
- **Lighting↔suggestion-engine seam (resolved-by-contract):** A's engine fires R1 "no light source" off
  *lamp furniture* count (`roles.ts model==='lamp'`), but E lights rooms with renderer lights (not lamps).
  E exports a pure predicate `roomLightingSatisfaction(roomId) ⇒ {hasLight,isLayered}` from
  `/lighting/src/contract.ts`; A's engine should consult it (import or mirror) so an E-lit room passes
  R1 + the single-overhead rule. `[affects: A,E]`

## Scene / Rendering (CONFIRMED — applies to everyone)

- **Renderer is React-Three-Fiber**, NOT plain Three.js. Deps `three ^0.169`, `@react-three/fiber ^8.17`,
  `@react-three/drei ^9.114`. `Canvas`/camera/`OrbitControls(makeDefault)` in `src/three/RoomView.tsx`. `[affects: all]`
- **World units are METERS.** Design space is centimeters; `src/three/coords.ts` `makeFrame()` converts
  cm→m and centers the room on its bbox center (`toWorld = (x-cx)/100`). Keep the cm↔m boundary explicit. `[affects: all]`
- **`<Canvas shadows flat>`:** `shadows`(bare) ⇒ `PCFSoftShadowMap`; `flat` ⇒ `NoToneMapping`, so colors
  render ~as authored and **light intensities are legacy (non-physical) units** — tune to THIS renderer, do
  not copy physically-based-units tutorials. `gl={{preserveDrawingBuffer:true}}` is set (B needs it for
  WebCodecs frame capture — don't remove). Camera fov 40, near 0.1, far 200. Scene background `#cdccc9`. `[affects: A,B,E]`
- **Port shared geometry read-only; do NOT import across packages** (the convention before `shared/lib`,
  still true for non-trivial math). B (collision), C (wall/opening + house coercion), E (coords), and
  C-persistence (RoomDesign/House type mirrors in `src/scene/slices.ts`) all COPY A's logic into their own
  package to keep **zero build coupling**. Cost = drift risk — re-sync when the source changes (owner pings). `[affects: all]`
- **Connectors are just `Opening`s on a shared wall, applied to BOTH rooms.** Openings carry
  `{wallId, t∈0..1, width, height, sill}`; `buildWallParts` subtracts the rectangular holes. Multi-room
  helpers (consume read-only via `multi-room/src/index.ts`): `toWorld`, `worldCorners`, `worldWalls`
  (wall world a→b + normal), `connectorWorldPoint`, `openingsForRoom`. `[affects: A,C,E]`
- **Walk collision order: resolve furniture before walls** (wall = hard constraint). `[affects: B]`
- **Scene seam = `sceneBus`** (mirror of `src/three/cameraBus.ts`): module-level handle,
  `setSceneHandle()`/`getSceneHandle()`, no React. **STATUS (cycle 2): NOW WIRED into the app by B** —
  `src/three/sceneBus.ts` + `src/three/Flythrough.tsx` (`<SceneBridge/>` inside the Canvas builds
  `getColliders()` from the live store; `<FlythroughHud/>` DOM overlay) + `<SceneBridge/>` added to
  `RoomView.tsx`. The engine adds only a `flythrough-overlay` group, removed on teardown. For cross-room,
  `getColliders()` must AGGREGATE every room's walls+furniture and treat connector openings as walkable gaps. `[affects: A,B,C]`
- **Mounting & stacking (A):** archetypes carry `mount = floor|wall|surface`. Wall/surface pieces are
  exempt from footprint collision and lifted (TV on a console at interior-standard height, mirror on a bare
  wall ~107–130cm). Mounted pieces MOVE WITH their host (`mount.dependentsOf` + store carry) even when
  locked. A "Move to wall" warning snaps a floating wall-piece flush. `src/three/mount.ts`. `[affects: A,B,E]`
- **Presentation lock = `lightMode`** (E, global flag in lighting store, additive in `lighting_schema`):
  ON ⇒ furniture locked + editing hints hidden; OFF ⇒ default. It never mutates each item's own `locked`,
  so toggling off restores prior state. Gating helpers `furnitureLocked(item,lightMode)` +
  `showEditingHints(lightMode)` in `/lighting/src/contract.ts`. B's flythrough auto-locks furniture +
  hides item overlays while open and restores on close (its own mechanism); B added an "✏️ Edit furniture"
  toggle that hands rendering back to OrbitControls for editing mid-session. `[affects: A,B,E]`

## Lighting & Time-of-Day (Agent E) — `/lighting`, `shared/lighting_schema.json` (v1.0, units = meters)

- Every room auto-gets a HemisphereLight ambient fill + a warm ceiling task light the moment it exists
  (never a dark box); editable + warm/neutral/cool (Kelvin→RGB) swatches. Layered = ambient + task (+accent).
- **The sun is ONE DirectionalLight and the SOLE shadow caster** (room lights `castShadow=false`); ONE
  global hemisphere (not per-room) — perf invariant = 1 shadow caster for 1→30 rooms.
- **Sun is a pure fn of (timeOfDay, northOffsetDeg)** — `elev=sin(t·π)·maxElevRad`, `az=t·π−π/2+north`,
  `pos=r·[cos(elev)sin(az), sin(elev), cos(elev)cos(az)]` (`/lighting/src/sun.ts`). So B can reproduce
  exact sun/shadows per recorded frame from `timeOfDay`. N is FIXED on the compass; a ☀ marker orbits.
- **Verified working values** (furnished 4×5m room, headless swiftshader): sun base intensity **1.35**
  (legacy units) ×`max(0,sin(t·π))`; hemisphere sky `#ffffff`/ground `#cfcbc2` int **0.7**; ambient **0.22**;
  ceiling task **0.8** warm `#ffd6aa`(2700K); shadow mapSize **2048** (4096 for big houses); bias **-0.0004**,
  normalBias **0.02**; ortho half-extent **max(houseHalfW,houseHalfD)+3m**; far **domeRadius+half·2+5**; domeRadius **30**.
- **R3F shadow-camera gotcha:** changing `shadow-camera-left/right/top/bottom`/`far` via JSX props does NOT
  auto-call `updateProjectionMatrix()`. Mutate `light.shadow.camera.*` imperatively in a `useEffect`, call
  `cam.updateProjectionMatrix()`, set `light.shadow.needsUpdate=true` (`/lighting/src/r3f/Sun.tsx`).
- **No-windows = unlit interior.** A closed box looks dark at "noon" because no window lets the sun in; the
  panel warns the user to add a window in Step 3. A passes `hasWindows` (design.openings has a `window`) to `<LightingControls>`.

## Build / Tooling

- **`main` is PR-gated.** `.githooks/pre-commit` blocks direct commits to main; `.githooks/pre-push` blocks
  direct pushes to main AND runs root `typecheck + test` before any push. `.github/workflows/ci.yml` runs
  typecheck + vitest + build on PRs into main. Advance main only via a merged PR. `npm run prepare` wires
  `core.hooksPath=.githooks` on install. `[affects: all]`
- **The repo is FIVE independent TS build islands** — `src`(A), `camera-flythrough`(B), `multi-room`(C),
  `lighting`(E), `persistence`(C f2) — each with its OWN `node_modules` + `tsconfig (include:["src"])` +
  vite/vitest, PLUS the Python `detection-pipeline`(B). Ports (dev ports): app 5180, server 5181, flythrough
  5184, lighting 5186, persistence 5187. `[affects: all]`
- **⚠ Root CI only typechecks/tests `src/`** (root tsconfig `include:["src"]`). It does **NOT** cover the
  sub-islands. A type error inside `/lighting`, `/multi-room`, `/camera-flythrough`, `/persistence` will
  pass CI and merge silently. **Coordinator MUST `tsc -b` + `vitest run` each island every cycle.** `[affects: D,B,C,E]`
- **`shared/lib/` is the FIRST cross-island TS import** (Agent F) — see the Shared-lib section. It resolves
  under each island's tsc + vitest despite living outside `include:["src"]` (`moduleResolution:"bundler"`
  pulls the imported leaf in). Its tests run under the ROOT vitest (`vitest.config.ts` includes
  `shared/lib/**/*.test.ts`); there is no package.json under `/shared`. `[affects: all]`
- **Video export uses `canvas-record`/WebCodecs**, deterministic step loop — NOT `MediaRecorder`/`captureStream`
  (CCapture legacy fallback). Requires `preserveDrawingBuffer`. Root dep `canvas-record@^4.2.0` (added by B
  when wiring flythrough into the app — keep it). `[affects: B]`
- **Detection VLM = `qwen2.5vl:7b` via Ollama (Apache-2.0).** Ultralytics YOLO is **AGPL-3.0** (network-use
  obligations) — opt-in only (`--detector yolo`), VLM is default. Watcher `--once` must BYPASS the settle
  window (else a just-dropped file is skipped); continuous mode keeps it to avoid half-written reads;
  atomic `.tmp`+rename writes. Browser can't read `shared/` directly → route via the Express server
  (`POST/GET /api/detect`, :5181). `[affects: A,B]`

## Shared canonical lib `shared/lib/` (Agent F — QA/dedup)

**`shared/lib/math.ts` is the single source of truth for these pure scalar helpers — do NOT re-fork them.**
Import: `import { clamp, clamp01, DEG2RAD } from '../../shared/lib/math'`.

| Export | Body | Migrated from |
|---|---|---|
| `clamp(v,lo,hi)` | `v<lo?lo:v>hi?hi:v` (NaN passes through) | src/geometry/collision.ts (dead, deleted), lighting/colorTemp.ts |
| `clamp01(v)` | `=clamp(v,0,1)` | lighting/sun.ts, multi-room/connectors.ts |
| `DEG2RAD` | `Math.PI/180` | src/data/personas.ts, lighting/sun.ts |

- **DECISION D1 RATIFIED (Agent D, cycle 2):** islands MAY import `/shared/lib` TS for trivial pure helpers
  — proven byte-identical + green across all 5 islands. The larger geometry bundle (`footprintCorners`,
  `polygonCentroid`, `pointInPolygon`, `dot2`, `obbAxes`/`obbOverlap`, `signedArea`, `pointOnWall`, full
  `bbox`, `buildWallParts`, `OBB` type) and guard bundle (`isObj`, `isFiniteNumber`, `looksLike*`) are the
  next candidates — F may proceed, **but D2/D3 below still gate them.**
- **D2 (HOLDS):** `/camera-flythrough` + `/persistence` declared ZERO cross-package coupling; lifting THEIR
  copies into shared/lib needs B's / C's sign-off (C already declined for persistence — it mirrors types
  read-only by design). Don't unilaterally dedup across a stated boundary.
- **D3 (HOLDS):** DIVERGENT items must NOT be blindly merged — `uid` (3 id FORMATS; serialized ⇒ data
  contract), `coerceHouse`/`wrapSingleRoom` (impure `Date.now()`, pinned by migrate.test), persistence
  `toWorld` (`{x,y}` + missing rotation/NaN guard), `deriveWalls`, `makeFrame`, download helpers. Each is an
  owner decision, not a mechanical merge.
- **`noUnusedLocals` gotcha:** lighting / multi-room / camera-flythrough set `noUnusedLocals:true` — when you
  import a helper you MUST delete the local copy in the SAME edit or tsc fails on the orphan.
- **Deliberately NOT consolidated** (same name, different behavior): `personas.ts` 4-arg `clamp(v,def,lo,hi)`,
  `archetypes.ts` `clampAxis` (returns a tuple), Python detection-pipeline inline clamps.

## Persistence hard-won bugs (Agent C — fix these patterns anywhere)

- **localStorage degrade must rehydrate.** An adapter that "falls back to in-memory" on a mid-session
  quota/availability throw ORPHANS every design already on disk unless `degrade()` copies existing entries
  into the fallback BEFORE flipping, idempotently. Never silently drop — surface a save-status error + retry.
- **Optimistic save reflection must not clobber a newer edit.** After an async save resolves, reflecting the
  saved envelope back wholesale overwrites an edit made DURING the save. Guard with identity: fully reflect
  only when `current.scene === justSaved.scene`; else adopt just rev/updatedAt and keep the newer scene.
- **Forward-compat round-trip.** If the contract says "unknown fields preserved," the loader must carry
  through unknown top-level keys and NOT downgrade a higher `schema_version`.
- **One cap, one place.** Duplicated cap constants (history MAX in two files) drift — route load + runtime
  through the same `capHistory`.
- **Showcase is a SEPARATE entry point** that only ever receives one design's envelope — never imports the
  store/library. Cardinal sin = a view link reaching the editor. Design defensively (own HTML entry).

## Gotchas

- **Commit cross-cutting shared files ATOMICALLY with their importers** `[affects: all, esp. D,E,F]`.
  Cycle 2: F created `shared/lib/math.ts` (untracked) + edited island files to import it, but left it all
  uncommitted; then E's broad `git add` swept the `lighting/*` import lines into the E8 commit **without**
  `shared/lib/math.ts` → the committed lighting island failed `tsc` (TS2307, missing module). D had to land
  F's file to repair it. Lesson: a shared/lib file + every importer go in ONE commit, on the author's branch.
- **Scope your `git add`.** Beyond the above, `git add -A` once swept `detection-pipeline/.venv` (8675 files).
  `.venv`, `__pycache__`, `*.tsbuildinfo`, regenerable `__shots/` belong in `.gitignore`; add specific paths.
- **Human-authorized cross-source edits happen.** At the human's explicit "I see nothing in the frontend"
  direction, B wired the flythrough into `src/three/` (sceneBus/Flythrough/RoomView) and E wired the lighting
  mount + Light Mode across 4 of A's files (RoomView, FurnitureEditor, Wizard, Furnish). These are committed
  + green; **Agent A should review/own them.** The stable contract parts are the bus + the `/lighting/src/contract.ts` helpers. `[affects: A,B,E,D]`
- **"Saved positions not preserved" was perceptual** — furniture x/z/rotation always round-tripped; the
  camera *view* wasn't saved. Fix: persist `design.view` (cam+target). `[affects: A]`
- **The live requirements log is `source/roomio.txt`, not repo root.** All agents append there. `[affects: all]`
- **Shared working copy churns under you.** Multiple agents commit/branch-switch the same checkout
  concurrently; a branch HEAD can advance mid-cycle (cycle 2: it gained 16 commits + 2 in-flight features
  while D worked). Coordinator: snapshot a committed ref, verify in an isolated `git worktree` (symlink each
  island's `node_modules`), integrate from refs — never from the dirty tree. `[affects: D]`
