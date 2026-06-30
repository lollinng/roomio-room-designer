/**
 * Collider debug overlay (Agent E) — the testing tool for "invisible wall" bugs.
 *
 * Renders the flythrough's collision footprints (walls + furniture) as magenta
 * wireframe boxes, converted to world space via the SAME frame the walker uses.
 * If a box doesn't line up with the rendered geometry, that's exactly where you'd
 * "hit an invisible wall." Toggle via useHouseView.debugColliders.
 *
 * This mirrors the collider source in Flythrough.tsx getColliders()/frame(): in
 * whole-house mode it shows the aggregated multi-room colliders; otherwise the
 * single active room's.
 */
import { useMemo } from 'react'
import { useStore } from '../store'
import { bbox, deriveWalls } from '../geometry/walls'
import { useHouse } from './houseSession'
import { useHouseView } from './houseViewMode'
import { layoutHouse, houseColliders, houseBoundsCm, type OBB } from './houseLayout'

interface DebugBox {
  pos: [number, number, number]
  rot: number
  size: [number, number, number]
}

export function ColliderDebug() {
  const debug = useHouseView((s) => s.debugColliders)
  const mode = useHouseView((s) => s.mode)
  const rooms = useHouse((s) => s.rooms)
  const activeId = useHouse((s) => s.activeId)
  const design = useStore((s) => s.design)

  const boxes = useMemo<DebugBox[]>(() => {
    if (!debug) return []
    let obbs: OBB[]
    let fr: { cx: number; cz: number }

    if (mode === 'house' && rooms.length > 1) {
      const designs = rooms.map((r) => (r.id === activeId ? design : r.design))
      const placed = layoutHouse(designs)
      obbs = houseColliders(placed).furniture // walls + furniture, all as OBBs
      const b = houseBoundsCm(placed)
      fr = { cx: b.cx, cz: b.cz }
    } else {
      const b = bbox(design.corners)
      fr = { cx: b.cx, cz: b.cz }
      obbs = design.furniture.map((f) => ({ cx: f.x, cz: f.z, w: f.w, d: f.d, rot: f.rotation }))
      // show the single room's walls as boxes too (collider is half-planes, but
      // the footprint is what matters for "is the wall where I think it is")
      for (const w of deriveWalls(design.corners)) {
        obbs.push({ cx: w.midX, cz: w.midZ, w: w.length, d: design.wallThickness, rot: Math.atan2(-w.dirZ, w.dirX) })
      }
    }

    return obbs.map((o) => ({
      pos: [(o.cx - fr.cx) / 100, 0.35, (o.cz - fr.cz) / 100] as [number, number, number],
      rot: o.rot,
      size: [Math.max(o.w / 100, 0.02), 0.7, Math.max(o.d / 100, 0.02)] as [number, number, number],
    }))
  }, [debug, mode, rooms, activeId, design])

  if (!debug) return null
  return (
    <group>
      {boxes.map((b, i) => (
        <mesh key={i} position={b.pos} rotation={[0, b.rot, 0]}>
          <boxGeometry args={b.size} />
          <meshBasicMaterial color="#ff2bd6" wireframe transparent opacity={0.9} />
        </mesh>
      ))}
    </group>
  )
}
