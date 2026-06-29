# Roomio — Shared LEARNINGS

Curated, cross-agent reference. Distinct from `source/roomio.txt` (the transactional comms log) —
this is the deduped, resolved knowledge base. Tags: `[affects: A,B,C]`.
A = interiors/presets/suggestions · B = detection + camera/flythrough · C = multi-room house/connectors · D = coordinator.

---

## Schemas & Contracts

- **`shared/archetypes.json` is the single source of truth for archetype ids** — owned by Agent A,
  auto-generated from `src/data/archetypes.ts` → `archetypes.catalog.json`. Currently **91 ids**
  (grew additively from the original 23). Fallback id is **`misc-box`** (the Placeholder Box).
  Any producer (B's classifier, C's essentials, A's presets) must emit/reference **only** ids from
  this file. A pings the log on every add/rename. `[affects: A,B,C]`
- **Additive-only schema evolution.** Every contract change so far has been new optional fields, never
  a reshape — so consumers never break. Examples: `RoomDesign.view`, `RoomDesign.roomType`,
  `RoomDesign.personaGenre`. Keep new fields optional + announce in the log before relying on them. `[affects: A,B,C]`
- **Contract versions in flight (all v1.0):** `detection_schema` (LOCKED), `camera_path_schema`,
  `scene_contract`, `house_schema`, `persona_preset_schema`, `rule_schema`. `[affects: A,B,C]`
- **`detection_schema` v1.0 is LOCKED** — shape will not change without an announce + ack in the log.
  `status="error"` with `proposals:[]` is valid (no crash); consumers validate leniently
  (`additionalProperties: true`). `[affects: A,B]`
- **`house_schema` v1.0 WRAPS, never forks, `RoomDesign`** — `HouseRoom.interior: RoomDesign` verbatim.
  Backward compat is mandatory: a v1 single-room save (bare `RoomDesign`) loads as a one-room house
  with empty connectors. The contract treats `interior` as opaque-but-required; the fields C's
  wall-cutting depends on are `corners[]` (cm polygon), `openings[]`, `wallHeight`, `wallThickness`. `[affects: A,C]`
- **⚠ UNRESOLVED — two `RoomType` taxonomies.** A's interior `RoomDesign.roomType`
  (`living|bedroom|studio|family|office|den`, drives the suggestion engine) overlaps but diverges from
  C's house-level `HouseRoom.type` (`bedroom|living|kitchen|bathroom|dining|office|foyer|hallway`).
  Both additive/optional so no build conflict, but a C "kitchen" room's wrapped interior can't carry a
  meaningful `roomType`. **Reconcile** (superset union, or explicit map) before they're made to interoperate. `[affects: A,C]`

## Scene / Rendering

- **Renderer = React-Three-Fiber** (`@react-three/fiber ^8`, `drei ^9`, `three ^0.169`).
  `Canvas`/camera/`OrbitControls(makeDefault)` live in `src/three/RoomView.tsx`. `[affects: A,B]`
- **World units = meters, centered on the room bbox** (`src/three/coords.ts`). Collision/footprint math
  is in **centimeters** with inward-normal correction + OBB (`src/geometry`). Keep the cm↔m boundary explicit. `[affects: A,B,C]`
- **`gl` has `preserveDrawingBuffer: true`** already — required for WebCodecs frame capture. Don't remove it. `[affects: A,B]`
- **Port shared geometry read-only; do NOT import across packages.** B (collision) and C (wall/opening math)
  both copy A's `src/geometry` logic into their own package instead of importing it, to keep **zero build
  coupling**. The cost is drift risk — re-sync when A changes the source (A pings the log). `[affects: A,B,C]`
- **Connectors are just `Opening`s on a shared wall, applied to BOTH rooms.** Reuse
  `deriveWalls` + `buildWallParts` semantics: openings carry `{wallId, t∈0..1, width, height, sill}`;
  `buildWallParts` already subtracts rectangular holes. `[affects: A,C]`
- **Walk collision order: resolve furniture before walls** (wall = hard constraint). `[affects: B]`
- **Scene seam = `sceneBus`** (mirror of the existing `src/three/cameraBus.ts`): a module-level handle with
  `setSceneHandle()`/`getSceneHandle()`, no React. The flythrough engine reads the handle and adds only its
  own objects under a single `flythrough-overlay` group (removed fully on teardown). For **cross-room**
  flythrough, `getColliders()` must AGGREGATE every room's walls+furniture and treat connector openings as
  walkable gaps. **Status: not yet wired in A's `src/three/` — see open seam below.** `[affects: A,B,C]`

## Build / Tooling

- **`main` is PR-gated.** `.githooks/pre-commit` blocks direct commits to main; `.githooks/pre-push` blocks
  direct pushes to main AND runs `typecheck + test` before any push. `.github/workflows/ci.yml` runs
  typecheck + vitest + build on PRs into main. Advance main only via a merged PR. `[affects: A,B,C,D]`
- **`npm run prepare` wires `core.hooksPath=.githooks`** on install — hooks are repo-managed, not local-only. `[affects: A,B,C]`
- **Sub-packages are isolated** — `/camera-flythrough` (own vite, port 5184) and `/multi-room` each have their
  own `package.json`/`vitest.config`. **Root CI does NOT run their tests** — verify them separately
  (`cd <pkg> && npx vitest run`). Coordinator runs all three suites each cycle. `[affects: B,C,D]`
- **Video export uses `canvas-record`/WebCodecs**, deterministic step loop — NOT `MediaRecorder`/`captureStream`
  (CCapture is a legacy fallback only). Requires `preserveDrawingBuffer`. `[affects: B]`
- **Detection VLM = `qwen2.5vl:7b` via Ollama (Apache-2.0).** Ultralytics YOLO is **AGPL-3.0** (network-use
  obligations for a hosted product) — kept opt-in only (`--detector yolo`), defaulting to the VLM path. `[affects: B]`
- **Detection watcher:** `--once` must BYPASS the settle window (else a just-dropped file is skipped);
  continuous mode keeps the settle window to avoid reading half-written files. Results written atomically
  (`.tmp` + rename). Browser can't read `shared/` directly → route detection through the Express server
  (`POST/GET /api/detect`, port 5181). `[affects: A,B]`

## Gotchas

- **Scope your `git add`.** `git add -A` once swept `detection-pipeline/.venv` (8675 files) + `__pycache__`
  into a commit. `.venv`, `__pycache__`, `*.tsbuildinfo`, and regenerable screenshot `__shots/` belong in
  `.gitignore`; add specific paths, not `-A`. `[affects: A,B,C]`
- **"Saved positions not preserved" was perceptual, not a data bug.** Furniture x/z/rotation always
  round-tripped exactly; the *camera view* wasn't saved, so reopening reset the angle and the layout merely
  *looked* shifted. Fix: persist `design.view` (cam + target) and restore on load. `[affects: A]`
- **The live requirements log is `source/roomio.txt`, not repo root.** All agents append there to avoid
  fragmenting comms. `[affects: A,B,C,D]`
- **Shared working copy churns under you.** Multiple agents commit/branch-switch the same checkout
  concurrently; a branch HEAD can advance mid-cycle. Coordinator: snapshot a committed ref, verify it in an
  isolated `git worktree` (symlink `node_modules`), and integrate from refs — never from the dirty tree. `[affects: D]`
