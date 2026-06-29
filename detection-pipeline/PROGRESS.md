# Detection Pipeline — Progress (Agent B)

Local, open-source furniture-detection pipeline for Roomio. Photo → schema-valid JSON
proposals (archetype + confidence + dominant color), handed to the front-end via `/shared`.
Suggestion-only, fully local via Ollama, isolated from Agent A's front-end.

Last updated: 2026-06-29 (cycle 1)

## Milestones

| ID | Deliverable | Status |
|----|-------------|--------|
| B0 | Scaffold `/detection-pipeline` + `/shared`; publish schema v1.0; log intent | 🟡 in progress |
| B1 | Ollama VLM call working on one photo (moondream → qwen2.5vl:7b) | ⬜ next |
| B2 | Closed-set classifier → valid archetype id + confidence + fallback | ⬜ |
| B3 | k-means dominant-color stage per region | ⬜ |
| B4 | `pipeline.py` end-to-end + schema-valid output | ⬜ |
| B5 | `watcher.py` + atomic file handoff (requests/ → results/) | ⬜ |
| B6 | README, tests, optional YOLO/HomeObjects-3K fast path | ⬜ |

## Done
- Read brief (`source/Roomio_Detection_Pipeline_Brief_AgentB.pdf`) + joint log.
- Created folders: `detection-pipeline/{tests,palette}`, `shared/{requests,results}`.
- Published `shared/archetypes.json` — **mirror of Agent A's real corpus** from
  `src/data/archetypes.ts` (23 ids, e.g. `sofa-3`, `sofa-love`, `sofa-sectional` …).
  **Fallback id is `misc-box`** (Agent A's real Placeholder Box id), NOT the brief's
  example `placeholder_box`.
- Published `shared/detection_schema.json` — v1.0 published contract (JSON-Schema, draft-07).
- `requirements.txt` written.

## In progress (B0)
- Python venv + deps install (background).
- Pulling Ollama vision models: `moondream` (validate plumbing) → `qwen2.5vl:7b` (background).
- Opening INTENT entry to `roomio.txt` pinging Agent A.

## Next
- B1: first VLM call on a real room photo, robust JSON parse.

## Key decisions / notes
- Joint log lives at **`source/roomio.txt`** (the only roomio.txt in the repo; holds the
  human's requirements). Brief says "repo root" but the live file is in `source/` — appending
  there to avoid fragmenting comms. Flagged in the log.
- Archetype ids are mirrored from Agent A's source; Agent A owns the corpus. Requested A
  confirm ownership of `shared/archetypes.json` going forward.
- License watch-out: Ultralytics YOLO is AGPL-3.0 (network-use obligations for hosted use).
  Defaulting to the VLM path (Qwen2.5-VL, Apache-2.0). YOLO fast path deferred to B6 + flagged.

## Isolation guarantees (self-audit)
- All code under `/detection-pipeline`; contract files under `/shared`; comms in `roomio.txt`.
- Never edits Agent A's front-end source. Python venv is local to this folder.
