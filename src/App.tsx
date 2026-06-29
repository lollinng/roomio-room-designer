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
    const q = new URLSearchParams(window.location.search).get('stage') as Stage | null
    if (q && STAGES.includes(q) && q !== 'start') {
      useStore.getState().resetDesign('rect')
      setStage(q)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div className="app">{stage === 'start' ? <StartScreen /> : <Wizard />}</div>
}
