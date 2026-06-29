# Agent C — Multi-Room & Connectors · PROGRESS

Domain: **"the house."** Expand Roomio from a single room to a connected multi-room
floor plan. The `House` schema **wraps** Agent A's `RoomDesign` (`room.interior`) —
it never replaces it. Everything optional: a single bedroom stays a complete, valid
design, and old single-room saves still load.

Isolation: all code in `/multi-room`; I also write `/shared` + `roomio.txt`. I never
edit Agent A's or Agent B's source. Common logic lives in single modules
(`src/geometry`, `src/util`, `src/data`) — no redundant copies.

## Milestones (brief §9)

| ID | Deliverable | Status |
|----|-------------|--------|
| **C0** | Read brief + roomio.txt; onboard; scaffold `/multi-room`; align schema with A; publish `shared/house_schema.json` | ✅ done |
| **C1** | Multi-room model: add/position multiple rooms; wrap A's room model; old single-room file loads | ✅ done |
| **C2** | Room typing + per-type essentials (incl. kitchen/bathroom) | ⏳ next |
| **C3** | Connectors on shared walls (hinged door + cased opening); opening cut in both rooms | ⬜ |
| **C4** | Full connector set + door swing/arc + swing-overlap warning (AC7) | ⬜ |
| **C5** | Adjacency suggestion rules (AC1–AC9), dismissible | ⬜ |
| **C6** | Kitchen work-triangle/zone + bathroom clearance guidance; asset requests; polish | ⬜ |

## What exists now (C0 + C1)

- `src/interior.ts` — Agent A's `RoomDesign` ported **read-only** (mirror of
  `src/types.ts`; re-sync if A pings a change). Zero build coupling.
- `src/geometry/walls.ts` — `deriveWalls` + `buildWallParts` ported read-only from
  A's `src/geometry/walls.ts`. This is the wall/opening-cutting reused for connectors.
- `src/util/id.ts` — single id minter for the package.
- `src/types.ts` — the `House` / `HouseRoom` / `Connector` / `Footprint` schema.
- `src/house.ts` — `createHouse`, `wrapSingleRoom`, `roomFromInterior`, `addRoom`,
  `moveRoom`, `footprintFromInterior`.
- `src/persistence.ts` — `coerceHouse` / `loadHouseJSON` / `saveHouseJSON`. Loads
  (1) a House, (2) a bare RoomDesign → one-room house, (3) A's design-map.
- `shared/house_schema.json` (v1.0) — published contract for A & B.

## Verify

```
cd multi-room
npm install
npm run typecheck   # clean
npm test            # vitest
```

## Coordination

- `roomio.txt`: onboarding + schema DECISION + REQUEST → A (confirm RoomDesign wrap)
  + REQUEST → B (house_schema published for cross-room camera) posted.
- Connector = an `Opening` on a shared wall, cut in both rooms via A's `buildWallParts`.
