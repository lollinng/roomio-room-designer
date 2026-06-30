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
- [x] **C2-2** — Save-failure retry (never drop; keep in memory; backoff) + version history.
      - Retry path lives in `AutosaveController` (built C2-1); now surfaced: demo failure toggle
        (`FlakyAdapter.setFailing`) + visible "Couldn’t save — retrying…" + recovery on restore.
      - Version history: `src/envelope/history.ts` (snapshot/cap/restore, throttled autosnapshots,
        manual checkpoints keep-preferentially); session `checkpoint`/`restoreVersion`/`history`; UI
        History panel. ⌘/Ctrl-S = manual restore point.
      - 22/22 vitest + 19/19 headless checks (failure→retry, rev frozen during failure, kept-in-memory,
        recovery, checkpoint→restore-point, restore-as-new-rev). Screenshot `verify-out/c2-2-retry.png`.
- [x] **C2-3** — My Designs library: grid of cards (thumbnail + name + last-edited), open / inline
      rename / duplicate / delete-with-undo; new design autosaved; sort (recent/name) + search.
      - Session actions `duplicate`/`renameDesign`/`deleteDesign`/`undoDelete` (+ `lastDeleted`).
      - Library UI: cards, inline rename, duplicate, delete + Undo snackbar, search + sort.
      - **Adversarial review (workflow) of the C2-0..C2-2 foundation found + FIXED 5 real bugs**
        (2 critical data-loss): (a) mid-session storage degrade orphaned the whole library →
        `degrade()` now seeds the fallback from localStorage first; (b) `onSaved` clobbered a newer
        in-flight edit → scene-reference check keeps the newer edit; (c) newer-schema envelope was
        downgraded + unknown top-level fields dropped → preserved on round-trip; (d/e) `MAX_HISTORY`
        divergence (15 vs 20) + reload recency-cut dropping manual checkpoints → reload routes through
        `capHistory`. Regression tests added for each.
      - 30/30 vitest + 26/26 headless checks. Screenshot `verify-out/c2-3-library.png`.
- [x] **C2-4** — Share panel + view/edit access (defaults to view) + view-only **showcase** link.
      - Showcase payload (`src/share/showcasePayload.ts`) = the SECURITY BOUNDARY: a minimal `{name, scene}`
        projection (drops design_id/share-tokens/history/thumbnail) encoded URL-safe into the `#s=` fragment.
      - `src/share/link.ts`: access defaults to view, plain-language sentences, `buildShowcaseUrl`, clipboard.
      - **Isolated showcase entry** (`showcase.html` → `src/showcase/*`): imports ONLY the decoder + a
        self-contained 3D scene (`render/worldGeometry.ts` + `showcase/Scene.tsx`, glass-dollhouse) +
        guided walkthrough. NO session/library/editor in its import graph → a view link is structurally
        unable to reach the editor or other designs.
      - Share panel UI (view/edit/private, copy-link, open showcase, `.roomio` export); `.roomio` import in Library.
      - 38/38 vitest + **36/36 headless checks** incl. the cardinal-sin guard: showcase opened in a FRESH
        incognito context (no localStorage) renders the room read-only with **no editor chrome / no edit
        controls / no link back to the editor**. Screenshots `verify-out/c2-4-{share,showcase}.png`.
- [x] **C2-5** — Exports (all produce REAL downloadable artifacts):
      - Image snapshot → PNG (high-res top-down render). Shopping list → CSV (`src/export/shoppingList.ts`,
        aggregated by type+colour+size with qty + rooms) + copy-text. Floor-plan PDF → dependency-free
        single-page PDF embedding the plan + title/dimensions (`src/export/pdf.ts`, JPEG via DCTDecode).
      - Flythrough VIDEO is Agent B's (camera_path + F6 MP4) — surfaced as a hand-off, not rebuilt.
      - 43/43 vitest + 39/39 headless checks; PDF verified valid + openable (`file` → "PDF 1.4, 1 page";
        Quartz rendered it). Screenshots/artifacts in `verify-out/`.
- [x] **C2-6** — Backward-compat + polish + match Roomio UI.
      - One-time, NON-DESTRUCTIVE import of A's pre-persistence `roomio.designs.v1` map into the new
        library (`src/storage/legacy.ts`); old single-room saves load as one-room houses.
      - Polish: storage label shows the real backend (`FlakyAdapter.kind` → inner), glass-dollhouse
        showcase, furniture draw order (rugs under furniture). Production build OK (2 entries;
        showcase bundle is separate from the editor — isolation holds at the bundle level too).
      - 45/45 vitest + 41/41 headless checks.

## Acceptance (brief "done" bar) — all verified in `scripts/verify.mjs`
| Acceptance item | Where |
|---|---|
| edit → "Saving…→Saved just now", no button | C2-1 checks |
| reload → design intact in My Designs with thumbnail | C2-1 checks |
| rename / duplicate / delete + undo | C2-3 checks |
| simulated save failure → retry, not loss | C2-2 checks |
| view-only showcase opened incognito → read-only walk of just that room, no editor/others | C2-4 checks |
| export image + shopping list + floor-plan PDF | C2-5 checks (real files) |
| old single-room save still loads | C2-6 check |

Run: `npm test` (45 unit) · `npm run verify` (41 headless browser checks) · `npm run build`.

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
