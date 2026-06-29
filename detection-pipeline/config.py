"""Central paths + constants for the Roomio detection pipeline (Agent B).

Everything is resolved relative to this file so the pipeline runs from any CWD.
Only ever reads/writes inside /detection-pipeline and /shared (isolation rule).
"""
from __future__ import annotations

from pathlib import Path

PKG_DIR = Path(__file__).resolve().parent          # .../roomio/detection-pipeline
REPO_ROOT = PKG_DIR.parent                          # .../roomio
SHARED_DIR = REPO_ROOT / "shared"

REQUESTS_DIR = SHARED_DIR / "requests"
RESULTS_DIR = SHARED_DIR / "results"
SCHEMA_PATH = SHARED_DIR / "detection_schema.json"
ARCHETYPES_PATH = SHARED_DIR / "archetypes.json"
PALETTE_PATH = PKG_DIR / "palette" / "colors.json"

CONTRACT_VERSION = "1.0"

# Vision models (local, via Ollama). Primary = strong structured-output VLM;
# fallback = tiny model just to validate plumbing / when primary isn't pulled.
DEFAULT_MODEL = "qwen2.5vl:7b"
FALLBACK_MODEL = "moondream"

# Accepted request image extensions.
IMAGE_EXTS = (".jpg", ".jpeg", ".png", ".webp", ".bmp")

# Confidence below which a detection is demoted to the placeholder box.
MIN_ARCHETYPE_CONFIDENCE = 0.30
