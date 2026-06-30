import { useEffect } from 'react'
import { useStore, type Stage } from './store'
import { useHouse } from './three/houseSession'
import type { ShapeId } from './types'
import { useAuth } from './auth'
import { Wizard } from './wizard/Wizard'
import { StartScreen } from './wizard/StartScreen'
import { AuthScreen } from './wizard/AuthScreen'

const STAGES: Stage[] = ['start', 'step1', 'step2', 'step3', 'step4', 'furnish']
const SHAPES: ShapeId[] = ['rect', 'l', 't', 'u', 'cut', 'beveled']

// Whether the FIRST load was a deep-link (?stage / ?preset). Captured ONCE so that
// ordinary in-app navigation — which now writes ?stage into the URL — doesn't
// retroactively bypass the auth gate.
const INITIAL_DEEP_LINK =
  typeof window !== 'undefined' &&
  Boolean(
    new URLSearchParams(window.location.search).get('stage') ||
      new URLSearchParams(window.location.search).get('preset'),
  )

/** The canonical URL for the current screen: each stage (+ active room) is its own URL. */
function canonicalUrl(): string {
  const stage = useStore.getState().stage
  const p = new URLSearchParams()
  p.set('stage', stage)
  if (stage === 'furnish') {
    const room = useHouse.getState().activeId
    if (room) p.set('room', room)
  }
  return `${window.location.pathname}?${p.toString()}`
}

export default function App() {
  const stage = useStore((s) => s.stage)
  const setStage = useStore((s) => s.setStage)
  const authStatus = useAuth((s) => s.status)
  const initAuth = useAuth((s) => s.init)

  // Check the session once on boot.
  useEffect(() => {
    initAuth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Deep-link / verification helper: ?stage=step2 jumps straight to a stage,
  // and ?preset=<genre_id> loads a persona room directly into the furnish stage.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const presetId = params.get('preset')
    if (presetId) {
      import('./data/personas').then(({ PERSONA_MAP }) => {
        const preset = PERSONA_MAP[presetId]
        if (preset) useStore.getState().loadPreset(preset)
      })
      return
    }
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
          const fl = live.design.furniture[2]
          if (fl) live.updateFurniture(fl.id, { locked: true })
          // select the sofa so the lock/delete toolbar is visible in screenshots
          live.selectFurniture(live.design.furniture[0]?.id ?? null)
        }
      }
      setStage(q)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // URL routing: give every screen (and the active room) its own URL, and make the
  // browser back/forward buttons move between them. Navigation pushes history;
  // popstate restores the stage/room WITHOUT resetting the design.
  useEffect(() => {
    let restoring = false
    // canonicalize the current screen's URL on boot (after any deep-link applied)
    try {
      window.history.replaceState(null, '', canonicalUrl())
    } catch {
      /* ignore (non-DOM) */
    }
    const sync = (mode: 'push' | 'replace' = 'push') => {
      if (restoring) return
      const url = canonicalUrl()
      if (url === window.location.pathname + window.location.search) return
      if (mode === 'replace') window.history.replaceState(null, '', url)
      else window.history.pushState(null, '', url)
    }
    const unsubStage = useStore.subscribe((s, prev) => {
      if (s.stage !== prev.stage) sync('push')
    })
    const unsubRoom = useHouse.subscribe((s, prev) => {
      if (s.activeId === prev.activeId) return
      // First room init (null → id) just completes the furnish URL — REPLACE so it
      // doesn't add a phantom history entry. A real room switch PUSHES so back/
      // forward navigates between rooms.
      sync(prev.activeId == null ? 'replace' : 'push')
    })
    const onPop = () => {
      restoring = true
      try {
        const p = new URLSearchParams(window.location.search)
        const st = (p.get('stage') as Stage) || 'start'
        const room = p.get('room')
        if (room) {
          const h = useHouse.getState()
          if (h.activeId !== room && h.rooms.some((r) => r.id === room)) h.switchRoom(room)
        }
        useStore.getState().setStage(STAGES.includes(st) ? st : 'start')
      } finally {
        restoring = false
      }
    }
    window.addEventListener('popstate', onPop)
    return () => {
      unsubStage()
      unsubRoom()
      window.removeEventListener('popstate', onPop)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ?stage / ?preset deep-links bypass the auth gate (verification convenience).
  const deepLinked = INITIAL_DEEP_LINK

  if (authStatus === 'loading') {
    return (
      <div className="app">
        <div className="start">
          <div className="boot-spinner" />
        </div>
      </div>
    )
  }

  if (authStatus === 'anon' && !deepLinked) {
    return (
      <div className="app">
        <AuthScreen />
      </div>
    )
  }

  return <div className="app">{stage === 'start' ? <StartScreen /> : <Wizard />}</div>
}
