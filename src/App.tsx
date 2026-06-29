import { useEffect } from 'react'
import { useStore, type Stage } from './store'
import { Wizard } from './wizard/Wizard'
import { StartScreen } from './wizard/StartScreen'

const STAGES: Stage[] = ['start', 'step1', 'step2', 'step3', 'step4', 'furnish']

export default function App() {
  const stage = useStore((s) => s.stage)
  const setStage = useStore((s) => s.setStage)

  // Deep-link / verification helper: ?stage=step2 jumps straight to a stage.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const q = params.get('stage') as Stage | null
    if (q && STAGES.includes(q) && q !== 'start') {
      useStore.getState().resetDesign('rect')
      if (params.get('seed')) {
        const st = useStore.getState()
        const w = st.walls
        if (w[0]) st.addOpening('single', w[0].id, 0.38)
        if (w[1]) st.addOpening('windowDouble', w[1].id, 0.5)
        if (w[2]) st.addOpening('french', w[2].id, 0.6)
        if (w[3]) st.addOpening('windowSingle', w[3].id, 0.5)
      }
      setStage(q)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div className="app">{stage === 'start' ? <StartScreen /> : <Wizard />}</div>
}
