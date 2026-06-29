import { useEffect } from 'react'
import { useStore, type Stage } from './store'
import type { ShapeId } from './types'
import { Wizard } from './wizard/Wizard'
import { StartScreen } from './wizard/StartScreen'

const STAGES: Stage[] = ['start', 'step1', 'step2', 'step3', 'step4', 'furnish']
const SHAPES: ShapeId[] = ['rect', 'l', 't', 'u', 'cut', 'beveled']

export default function App() {
  const stage = useStore((s) => s.stage)
  const setStage = useStore((s) => s.setStage)

  // Deep-link / verification helper: ?stage=step2 jumps straight to a stage.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const q = params.get('stage') as Stage | null
    if (q && STAGES.includes(q) && q !== 'start') {
      const shapeParam = params.get('shape') as ShapeId | null
      const shape = shapeParam && SHAPES.includes(shapeParam) ? shapeParam : 'rect'
      useStore.getState().resetDesign(shape)
      if (params.get('seed')) {
        const st = useStore.getState()
        const w = st.walls
        if (w[0]) st.addOpening('single', w[0].id, 0.38)
        if (w[1]) st.addOpening('windowDouble', w[1].id, 0.5)
        if (w[2]) st.addOpening('french', w[2].id, 0.6)
        if (w[3]) st.addOpening('windowSingle', w[3].id, 0.5)
        // furniture spread across the default 600x400 room (center 300,200)
        st.addFurniture('sofa-3', 300, 320)
        st.addFurniture('table-coffee', 300, 235)
        st.addFurniture('bed-queen', 470, 110)
        st.addFurniture('decor-plant', 110, 110)
        st.addFurniture('chair-office', 140, 300)
        st.selectFurniture(null)
        // demo-only: showcase selected-opening resize + a locked item (read fresh state)
        const live = useStore.getState()
        if (q === 'step3') live.selectOpening(live.design.openings[0]?.id ?? null)
        if (q === 'furnish') {
          const f = live.design.furniture[2]
          if (f) live.updateFurniture(f.id, { locked: true })
        }
      }
      setStage(q)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div className="app">{stage === 'start' ? <StartScreen /> : <Wizard />}</div>
}
