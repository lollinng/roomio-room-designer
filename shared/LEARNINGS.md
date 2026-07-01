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

---

## Detection / "Scan a room photo" upload (Agent F bugfix, 2026-06-30)

The HEIC/large-photo upload path had three independent failure points — fixed; watch for these:

- **Server body-parser ORDER (server/index.js):** `/api/detect` needs a large body (base64 photos), and its
  `express.json({limit:'15mb'})` MUST be registered BEFORE the global `express.json({limit:'2mb'})`. body-parser
  skips a request whose body is already parsed, so detect gets 15mb while other routes keep 2mb. Registered after,
  the global 2mb parser rejects any photo >2 MB with 500 PayloadTooLargeError (the override never runs). Most
  phone photos exceed 2 MB — this silently broke ALL detection uploads, not just HEIC.
- **HEIC needs pillow-heif (detection-pipeline):** PIL + OpenCV can't decode iPhone HEIC. `pip install pillow-heif`
  + `register_heif_opener()` in color.py. `Image.open` then decodes by CONTENT, so the server's filename doesn't
  matter. `.heic/.heif` are in config.IMAGE_EXTS.
- **Ollama can't read HEIC/WEBP and 24 MP overflows ctx:** the pipeline downscales the working image to
  `MAX_VLM_IMAGE_DIM` (1536, config.py) and re-encodes non-stb_image formats to a temp JPEG for the VLM
  (color.vlm_readable_path); `VLM_NUM_CTX=8192` gives headroom over the big closed-set prompt. Bboxes/color stay
  consistent because both run on the same downscaled array.
- Server now sniffs magic bytes → honest request extension (.heic/.png/.webp) + matching sidecar. Front-end
  ScanRoom.tsx polls 120s (cold-model first scan ~67s) and shows the real error on status=error.

---

## Furniture catalog — kitchen & bathroom fixtures (Agent F, 2026-06-30)

The corpus now has **103** archetypes incl. two fixture categories beyond living/bedroom:
- **kitchen**: `kitchen-counter` (Counter & Cabinets), `kitchen-island`, `kitchen-sink`, `kitchen-stove`,
  `kitchen-fridge`, `kitchen-hood` (wall-mounted).
- **bathroom**: `bath-toilet`, `bath-vanity`, `bath-shower` (walk-in, wall head), `bath-tub-alcove`,
  `bath-tub-freestanding`, `bath-jacuzzi`.

### Adding a new fixture (the full wiring — miss one and it silently renders as a box / files under "Other")
1. `src/data/archetypes.ts` — add the kind to BOTH the `ModelKind` union AND the `MODEL_KINDS` runtime array
   (normalize() downgrades unknown models → `box`).
2. `src/three/Furniture3D.tsx` — write a `buildX(W,D,H,color)` builder (W/D/H in METERS; compose `Box`/`Cyl`;
   LOCAL space: footprint centered at x=0/z=0, base on floor at **y=0**) and add a `case` in `FurnitureModel`'s switch.
3. `src/data/archetypes.catalog.json` — add the entry (id, category, name, icon, model, w/d/h, min/max, color,
   `"mount": "wall"` for wall pieces). Keep `min ≤ default ≤ max`.
4. New category? add it to `FurnitureCategory` (`src/types.ts`), `CATEGORIES` AND `CATEGORY_ORDER` (archetypes.ts).
5. Re-sync `shared/archetypes.json` from the catalog (mirror = `{id,category,name,default_color_hex}` per entry +
   the categories list) so the detector can emit it.
6. `multi-room/src/data/roomTypes.ts` — point any room-type essential at the real id (was `null` → placeholder).
   The asset-gap system (`assetRequests.ts` / `missingAssetsFor`) reports essentials still `archetype: null`.

Notes: `kitchen-sink` and `bath-vanity` share the `vanity` model (cabinet + basin + faucet) by design. Tubs use a
filled-basin stylization (solid inset, not a hollowed cavity) — fine for furniture scale. **Tests that hardcode the
corpus size will break on every add** — assert a floor (`>= N`), not `=== N` (see roomTypes.test.ts / the detection
corpus test).

---

## Photo Texture Mapping (Agent H)

Code in `/texturing`. Contracts: `shared/texture_schema.json` (v1.0) + `shared/pbr_conventions.json` (v1.0-draft).

### UVs — the corpus is ALREADY texture-ready (the brief's #1 worry doesn't bite here)
- **Every furniture mesh in `src/three/Furniture3D.tsx` is a Three.js PRIMITIVE** (box / cylinder /
  sphere / cone / torus), and primitives ALL auto-generate a `uv` attribute. There are **no** custom
  `BufferGeometry` / `LatheGeometry` / `ExtrudeGeometry` / `ShapeGeometry` / merged geometries anywhere.
  So the documented **"no uv → only dots" failure CANNOT occur** on the current corpus. Every mesh already
  uses `meshStandardMaterial` (accepts `map`/`roughnessMap`/`normalMap`).
- **The real UV concern is tiling SCALE, not missing UVs.** A box's UVs are `0..1` per face regardless of
  physical size, so a naive `repeat=(1,1)` shows the pattern at different cm-scales on differently-sized
  meshes. **Use world-space tiling** — the exact trick the floor already uses (`src/three/textures.ts` +
  `Room.tsx`/`HouseView.tsx`): `repeat = areaCm/100`, UVs from `worldPos/repeat`. For furniture:
  `texture.repeat = worldDimCm / repeat_cm`. Mirror this; don't invent a second tiling model.
- **Triplanar/box-projection is the SAFETY NET**, not the default. Reserve it for the two meshes whose
  default UVs distort: `buildTubFreestanding` (anisotropic cylinder scale, ~L893) and the open-ended
  lamp-shade cone (~L505). Authored primitive UVs are fine everywhere else.

### NEW-ASSET RULE (record for A and any asset source going forward)
> **Every new furniture asset entering the catalog MUST ship UV-mapped with named material slots.**
> In practice that means: build from Three.js primitives (auto-UV) OR provide a geometry that carries a
> `uv` attribute; and tag each mesh's role via `userData.role` (`body`|`cushion`|`wood`|`metal`|`glass`|
> `accent`) so a texture can target the right surface. If neither is possible, the asset must fall back to
> triplanar projection. This is what makes "every asset supports textures" literally true. (See the
> kitchen/bath "Adding a new fixture" checklist above — add a step: confirm UVs + set `userData.role`.)

### PBR map conventions (so textures + rendering agree — published by H, pending G ratification)
- **Color space per map** (unchanged by `<Canvas flat>`, which only sets `NoToneMapping`):
  albedo = `THREE.SRGBColorSpace`; roughness / normal / metalness / AO = **linear** (`THREE.NoColorSpace`
  default — never set sRGB on a data map). Forward-compatible with G's planned ACESFilmic + sRGB output.
- **Normal maps**: `TangentSpaceNormalMap` (three default), **+Y (OpenGL)** green channel. If a height→normal
  bake yields −Y (DirectX), invert green at BAKE time. Keep relief subtle; expose `material.normalScale`.
- **Roughness**: `material.roughness = 1.0` so the map fully drives it. Bands: fabric `0.8–0.95`,
  wood `0.4–0.6`, metal `0.2–0.5`. Avoid 0/1 extremes.
- **Metalness**: dielectric fabric/wood → `metalness = 0`, **no** metalnessMap; only emit one for metals.
- **AO**: do NOT bake `aoMap` into a tiling photo material (no meaningful contact AO in a tile). Let G's
  SSAO/GTAO post-pass do contact AO. three 0.169 unified UV (`texture.channel`) ⇒ aoMap can reuse channel 0;
  a separate `uv2` is **not** required (the "aoMap needs uv2" advice is pre-r150).
- **Tiling**: `wrapS = wrapT = RepeatWrapping` on ALL maps; apply the SAME `repeat`/rotation to all so they
  stay registered; `anisotropy = 8` (matches `textures.ts`).
- **De-light** is a rendering-CORRECTNESS rule, not just aesthetics: with G's IBL + E's lights doing the
  lighting, baked highlights/shadows in albedo **double-light**. Verify de-lit under a lit room.

### Ownership seam (H ↔ E/G — don't both mutate the same material)
- **H owns**: per-material texture maps + each map's `colorSpace`/`wrap`/`repeat`/rotation/`anisotropy`/`channel`.
- **E/G own**: `renderer.toneMapping`, `renderer.outputColorSpace`, `scene.environment` (HDR IBL/PMREM),
  bloom/SSAO passes, shadow config. On a textured item, `item.color` stays as the fallback/tint.

### Persistence + detection seams (confirmed during onboarding)
- **Applied texture = a REFERENCE, never bytes.** `FurnitureItem.texture` (additive, optional) carries
  content-hash `asset_id`/`maps` (`sha256:…`); image bytes live in a content-addressed store
  (`roomio.asset.<hash>`) behind C's `StorageAdapter` (IndexedDB for large blobs). The additive field
  round-trips through C's coerce/migrate verbatim — **no `/persistence` change needed**. Embedding bytes
  would bloat every save AND every full-scene history snapshot.
- **Crop is client-side from B's existing output.** Detection proposals already carry `bbox` (pixel
  `[x,y,w,h]`) + `image.width/height` in the **downscaled** working-image space. H crops from bbox + the
  user's original photo via canvas (normalize by result image dims → scale to natural size). **No edit to
  B's pipeline.** Front-end gaps H closes: ScanRoom discards the uploaded dataURL (must persist it);
  `src/detect.ts` `DetectionResult` doesn't surface `image` dims (additive, type-only).

---

## Realistic Rendering (Agent G)

Code in `/rendering` (port 5188). Contract: `shared/render_schema.json` (v1.0). The "ray tracing"
ask delivered the way real-time WebGL does it: PBR + IBL + ACESFilmic tone mapping + AO + emissive
bulbs/bloom — layered ON TOP of E's lighting. Optional stretch = a static-camera path-traced hero still.

### Renderer ownership seam (G ↔ E) — CONFIRMED, applies to the mount
- `<Canvas shadows flat>` stays UNCHANGED. `shadows` (PCFSoftShadowMap) = **E** (the sun is E's
  caster). `flat` (NoToneMapping) is **deliberately KEPT** so G's post `EffectComposer` owns ACESFilmic
  tone mapping + sRGB output. **Removing `flat` or setting `gl.toneMapping` = ACES applied TWICE
  (washed/clipped).** Tone-map ONLY in the composer.
- G mounts entirely as `<Canvas>` CHILDREN: `<RealismLayer/>` = IBL (`scene.environment`) +
  MaterialEnhancer + EffectComposer. NO Canvas-prop changes. One mount in RoomView covers single-room
  AND whole-house (HouseView renders inside the same, only, Canvas).
- E owns light units (legacy/non-physical); G does NOT change them. ACES's apparent-brightness shift is
  compensated by G's tone-mapping `exposure` (a custom pre-ACES linear multiply), not by editing E's lights.
- **IBL double-ambient:** `scene.environment` ADDS ambient on top of E's hemisphere(0.85)+ambient(0.32).
  Default ships conservative (environmentIntensity 0.55 → reflections + subtle bounce, no E change).
  Ideal upgrade (the brief's "lean on IBL for ambient") needs E to cut the flat fill (hemisphere ~0.25,
  ambient ~0.08) so IBL becomes the primary ambient — OPEN co-tune REQUEST → E.

### Dep pins (R3F 8 / three 0.169 — version-compat is delicate)
- `@react-three/postprocessing@2.19.1` (EXACT). **3.x requires React 19 / R3F 9 — will NOT mount here.**
- `postprocessing@6.37.8` (EXACT; three peer `>=0.157 <0.183`). Modes incl. ACES_FILMIC, AGX, NEUTRAL.
- N8AO is **vendored inside @react-three/postprocessing** (`<N8AO/>` component) — no separate `n8ao` dep needed.
- Hero path-tracer (G5): `three-gpu-pathtracer@0.0.23` (NOT 0.0.24 → needs three≥0.180). Uses the existing
  single `three-mesh-bvh@0.7.8` (drei transitive) — two copies = instant BVH crash, so `npm dedupe`.
- The app build needs these in ROOT package.json too (like B's canvas-record) — see rendering/INTEGRATION.md.

### Tuned values (furnished harness, SwiftShader headless, 2026-07-01)
| Param | Value | Notes |
|---|---|---|
| tone mapping | ACES_FILMIC (post `<ToneMapping>`, last effect) | renderer stays NoToneMapping (`flat`) |
| exposure | 1.0 (slider 0.5–2.0) | custom pre-ACES linear-multiply Effect (renderer.toneMappingExposure is a NO-OP under NoToneMapping) |
| ibl.intensity (scene.environmentIntensity) | 0.55 | procedural drei `<Environment>` + `<Lightformer>` (no CDN/file — works offline/headless) |
| material envMapIntensity | 1.0 (per-material) | global dial is environmentIntensity; the two MULTIPLY (don't set both to 0.55) |
| bloom | threshold **1.0**, strength 0.85 (high), radius 0.65, mipmapBlur | selective via HDR emissive (NOT by lowering threshold) → no whole-room haze; needs HalfFloat buffer (composer default) |
| emissive boost | **×8** (MaterialEnhancer, idempotent via userData) | lifts A's authored emissive (lamp 0.45 / TV 0.35) above the 1.0 bloom threshold so bulbs/screens glow |
| N8AO | aoRadius 1.0, intensity 2.5, distanceFalloff 1, halfRes off(high)/on(med) | OFF at 'low'; quality presets perf/low/medium/high/ultra |
| multisampling | 4 (high) / 2 (medium) / 0 (low) | MSAA on the HalfFloat composer target |

### Material reality (from A's source — informs the runtime enhancer)
- Everything is `meshStandardMaterial` already (roughness 0.06–1.0, metalness 0–0.8, sRGB hex colors) —
  good PBR base. Floor = procedural canvas texture (sRGB); walls = solid color. NO normal/roughness maps,
  NO uv2 (so AO is the SSAO/N8AO post-pass, not a baked aoMap — REQUEST → H/A for uv2 + PBR map slots).
- Emissive today: lamp shade (`#ffd98a`, 0.45) + TV screen (`#0d1c2e`, 0.35). The enhancer boosts these;
  E's `meshBasic` sun gizmo + ceiling discs are skipped (not standard materials → untouched).
- `MaterialEnhancer` only sets uniforms (envMapIntensity, emissiveIntensity) — NO `needsUpdate`, so no
  shader recompiles. `scene.environment` auto-applies as the envMap to every standard material (no
  per-material envMap assignment needed).

### Review-confirmed gotchas (adversarial pass, 2026-07-01)
- **Don't pass continuous scalars (exposure) as @react-three/postprocessing effect PROPS.** `wrapEffect`
  bakes props into the effect constructor `args` (keyed on `JSON.stringify(props)`), so every change
  re-instantiates the effect AND rebuilds the whole EffectPass (shader recompile). Drive continuous
  values IMPERATIVELY via a ref + a zustand `subscribe` (set the uniform in place); select only
  STRUCTURAL fields reactively so the composer component doesn't re-render. (rendering/src/r3f/RealismPost.tsx)
- **The v2 EffectComposer wrapper never disposes the composer it recreates.** Changing `multisampling`
  (or frameBufferType/enableNormalPass) rebuilds it via useMemo and LEAKS the old GPU render targets.
  Capture the composer via `ref` and `dispose()` it in a `useEffect` cleanup keyed on `multisampling`
  (also fires on unmount). Otherwise repeated quality toggles leak VRAM (crashes weak/mobile GPUs).
- **Hero path-tracer: WebGL2 is necessary but not sufficient.** A GPU can report `isWebGL2` yet fail to
  drive the tracer's float render targets (software GL / some mobile) — `renderSample()` no-ops, samples
  stay 0, UI hangs on "Rendering… 0". Add a watchdog (~5s): if samples haven't advanced, set
  `heroSupported=false` + deactivate -> graceful raster fallback. (rendering/src/r3f/HeroRender.tsx)
