# Detection Pipeline — Progress (Agent B)

Local, open-source furniture-detection pipeline for Roomio. Photo → schema-valid JSON
proposals (archetype + confidence + dominant color), handed to the front-end via `/shared`.
Suggestion-only, fully local via Ollama, isolated from Agent A's front-end.

Last updated: 2026-06-30 (cycle 2)

## Milestones

| ID | Deliverable | Status |
|----|-------------|--------|
| B0 | Scaffold `/detection-pipeline` + `/shared`; publish schema v1.0; log intent | ✅ done |
| B1 | Ollama VLM call working on one photo (moondream validated) | ✅ done |
| B2 | Closed-set classifier → valid archetype id + confidence + fallback | ✅ done |
| B3 | k-means dominant-color stage per region | ✅ done |
| B4 | `pipeline.py` end-to-end + schema-valid output | ✅ done |
| B5 | `watcher.py` + atomic file handoff (requests/ → results/) | ✅ done |
| B6 | README, tests, optional YOLO/HomeObjects-3K fast path | 🟡 in progress |
| —  | Final acceptance + accuracy tuning with qwen2.5vl:7b | ⬜ pending (model pulling) |

## Done
- Read brief + joint log; folders scaffolded; contract published & **confirmed by Agent A**.
- `shared/archetypes.json` — mirror of Agent A's real corpus (23 ids, fallback `misc-box`).
- `shared/detection_schema.json` — v1.0 (draft-07 JSON-Schema), **Agent A confirmed it fits the
  confirm-UI; treated as a locked, published API**.
- Stages built & verified:
  - `archetypes.py` — closed-set resolver (valid-id-or-`misc-box`, non-furniture skip, keyword rules).
  - `color.py` — k-means CIELAB dominant color + background rejection + nearest-palette naming.
  - `vlm.py` / `detect.py` — Ollama wrapper, constrained prompt, robust JSON + bbox coercion.
  - `classify.py` — VLM-hint/keyword/fallback resolution, low-confidence demotion (D-4), optional refine.
  - `pipeline.py` — orchestration, schema self-validation, **never raises** (error → valid error result).
  - `watcher.py` — atomic `.tmp`+rename handoff, `<id>.request.json` sidecar support, idempotent.
- Tests: **22/22 offline unit tests green** (`tests/test_pipeline.py`, stdlib only). `smoke_vlm.py`
  for the live VLM path. README (`README.md`) + fixture provenance (`tests/fixtures.md`).
- End-to-end verified with moondream: watcher consumed a request+sidecar and wrote a schema-valid
  result. moondream is weak (whole-image bbox, 1 item → demoted to `misc-box`) — validates plumbing
  only, exactly as the brief predicted.
- Git hygiene: untracked an accidentally-committed `.venv` (8675 files) + `__pycache__` (commit 6537ee3).

## Next
- qwen2.5vl:7b finishing download → run real acceptance on living/bedroom/dining fixtures;
  expect real archetypes + sensible colors + graceful fallback. Tune prompt/thresholds if needed.
- B6: optional YOLO/HomeObjects-3K deterministic fast path (gated; AGPL-flagged), more eval.

## Key decisions / notes
- Joint log = `source/roomio.txt` (only roomio.txt in repo). Agent A acked + logs there too.
- Agent A owns `shared/archetypes.json` (mirror of `src/data/archetypes.ts`); will ping on changes.
- License: default = VLM path (Qwen2.5-VL Apache-2.0). Ultralytics YOLO AGPL-3.0 → deferred/gated.

## Isolation guarantees (self-audit)
- All code under `/detection-pipeline`; contract under `/shared`; comms in `roomio.txt`.
- Never edits Agent A's front-end source. Python venv local to this folder, now gitignored.
