# Roomio — Persistence & Sharing (Agent C, feature 2) — PROGRESS

Owner: Agent C. Code lives in `/persistence` only (+ `/shared`, `roomio.txt`, `LEARNINGS.md`).
Storage tier: **local-first now** (on-device + `.roomio` export/import); cloud accounts + live
share URLs are a scoped follow-on. Agent D merges.

Re-read `source/roomio.txt` + `shared/LEARNINGS.md` at the start of every cycle.

## Milestones (brief §9)

- [x] **C2-0** — Scaffold `/persistence`; decide storage tier (local-first) + log it; publish
      save-envelope schema; onboarding + REQUESTs to A/E/B.
      - `shared/save_envelope_schema.json` (v1.0) published.
      - Envelope types (`src/envelope/types.ts`), forward-migration (`src/envelope/migrate.ts`),
        `.roomio` export/import (`src/envelope/serialize.ts`), factory + duplicate
        (`src/envelope/factory.ts`), read-only scene mirrors + house coercion (`src/scene/`).
      - 8/8 vitest green (backward-compat for all 3 legacy shapes + round-trip + lighting
        pass-through + duplicate independence); typecheck clean.
- [x] **C2-1** — Autosave engine: debounced autosave + visible status + optimistic UI + manual save + unsaved-exit.
      - `src/autosave/engine.ts` (debounce, coalesce-mid-flight, retry-never-drop), `status.ts`,
        `beforeUnload.ts`; `src/storage/{adapter,repository}.ts` (localStorage + in-memory fallback +
        FlakyAdapter); `src/app/session.ts` (optimistic store, thumbnail-on-save, rev bump).
      - UI: `SaveStatusIndicator` (spinner + live relative time + in-memory warning), `Floorplan`
        canvas, demo Editor (rename, edit, ⌘/Ctrl-S, Save), baseline Library, App shell.
      - 18/18 vitest + 10/10 headless browser checks green (Saving…→Saved, optimistic, rev advance,
        reload-persists-with-thumbnail, reopen round-trip). Screenshots in `verify-out/`.
- [ ] **C2-2** — Save-failure retry (never silently drop; keep in memory; backoff) + (stretch)
      lightweight version history / restore points.
- [ ] **C2-3** — My Designs library: grid of cards (thumbnail + name + last-edited), open / inline
      rename / duplicate / delete-with-undo; new design = "Untitled room" autosaved; sort/filter.
- [ ] **C2-4** — Share panel: copy-link + view/edit access (default view) + a dedicated view-only
      **showcase** link (read-only walkthrough reusing B's flythrough; never the editor/library).
- [ ] **C2-5** — Exports: image snapshot, furniture shopping list, floor-plan PDF (top-down, room
      labels + dims from house data); flythrough video via B.
- [ ] **C2-6** — Backward-compat migration hardening + polish + match Roomio's clean panel UI; cleanup.

## Architecture notes
- `src/scene/slices.ts` — read-only structural mirrors of A's RoomDesign + C's House (+ E's
  LightingState as opaque). Source of truth unchanged in A/C/E.
- `src/scene/coerce.ts` — read-only port of C's house coercion (resync if C changes).
- `src/envelope/migrate.ts` — the ONE place that reads the past. New format = one new branch.
- Two harness entries planned: `index.html` (full demo) + `showcase.html` (view-only, isolated).

## Open coordination
- REQUEST → A: confirm RoomDesign is the full interior state; confirm `personaGenre` = preset id.
- REQUEST → E: confirm LightingState is complete to persist; preferred serialize selector?
- REQUEST → B: read-only playback flag for showcase + MP4 export entry signature.
- → D: ratify the local-first storage-tier decision.
