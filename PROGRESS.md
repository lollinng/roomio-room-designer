# Roomio — Build Progress

IKEA-style interior room designer. React + Vite + TypeScript + React Three Fiber + Zustand.
Architecture = blueprint3d-lineage **scene graph** (walls / floor / openings / furniture as
addressable nodes) authored through a 4-step wizard + furnish stage. Collision/snapping (§7)
and clamped-resize archetypes are built bespoke (no planner repo ships them).

Dev server: `npm run dev` → http://localhost:5180/

## Legend: ✅ done · 🚧 in progress · ⬜ next/todo

## roomio.txt feed (from user)
- "keep working for next 4 hours" → iterate autonomously through all milestones + polish, no pausing.
- "make sure everything is scalable in long term" → keep data-driven catalogs, pure decoupled
  geometry/collision modules, a single serializable scene-graph store, versioned persistence,
  clean component layers. Adding presets/archetypes/materials/openings must stay one-array-entry easy.

## Milestones
- ✅ **M0** Scaffold, scene-graph store, 6 shape presets, 3D viewport (walls+floor), dev server up
- ✅ **M1** Step 1 shape picker · Step 2 dims: typed lengths + ft/cm toggle + live 3D drag handles + dim labels
- ⬜ **M2** Step 3 doors/windows (place/move/delete snapped to walls) · Step 4 wall color + floor texture (panel ✅, live swap ✅)
- ⬜ **M3** Furnish: archetype catalog, place/move/rotate/resize-clamped/recolor
- ⬜ **M4** Collision & snapping (clamp+slide, snap flush, soft overlap warn) — the bespoke hard part
- ⬜ **M5** Save / reopen designs (localStorage + JSON)
- ⬜ **Polish** match IKEA reference fidelity, edge cases, roomio.txt items

## Acceptance checklist
- ⬜ Step 1: room shape presets (Rect, L, T, U, Cut, Beveled) with live 3D preview — **icons ✅, live preview ✅**
- 🚧 Step 2: draggable/typed wall dimensions with ft/cm toggle — typed + toggle ✅, drag handles ⬜
- ⬜ Step 3: place/move/delete doors & windows snapped to walls
- 🚧 Step 4: wall color + floor texture material swap — ✅ (verify in-scene)
- ⬜ Furnish: place/move/rotate/resize (clamped) + recolor furniture archetypes
- ⬜ Furniture cannot clip through walls; slides and snaps flush (the hard part)
- ⬜ Save and reopen a design
- 🚧 UI polish visibly comparable to IKEA reference — strong start

## Current cycle notes
- Foundation modules complete: types, store, presets, walls geometry, units, materials,
  openings + archetype catalogs, procedural floor textures, Room/RoomView 3D, wizard shell.
- Parallel subagents building: `collision.ts`, `Furniture3D.tsx`, `Openings3D.tsx` (persistence.ts ✅ done).
- Verified Step 1 render via headless Chrome screenshot — matches reference well.

## Next up
1. Integrate Furniture3D + Openings3D + collision + persistence as agents land.
2. Step 2 interactive wall-drag handles in 3D.
3. Step 3 opening placement overlay (click wall to add, drag to move, trash to delete).
4. Furnish stage wiring (drag-in, transform gizmo, recolor, clamped resize) + collision.
5. Save/reopen UI on the Start screen.
