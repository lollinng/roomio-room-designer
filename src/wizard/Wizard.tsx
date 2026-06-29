import { useEffect, useState } from 'react'
import { useStore, type Stage } from '../store'
import { RoomView } from '../three/RoomView'
import { saveDesign } from '../persistence'
import { Step1Shape } from './Step1Shape'
import { Step2Dimensions } from './Step2Dimensions'
import { Step3Openings } from './Step3Openings'
import { Step4Style } from './Step4Style'
import { Furnish } from './Furnish'

const HINTS: Record<Exclude<Stage, 'start'>, string> = {
  step1: 'Drag to orbit · scroll to zoom',
  step2: 'Drag a wall to resize, or type an exact length',
  step3: 'Pick a style, then click a wall to place it',
  step4: 'Choose a wall colour and floor finish',
  furnish: 'Click a piece to add · drag to move · it snaps to walls',
}

const META: Record<Exclude<Stage, 'start'>, { eyebrow: string; title: string }> = {
  step1: { eyebrow: 'Step 1 of 4', title: 'Set the shape and size' },
  step2: { eyebrow: 'Step 2 of 4', title: 'Adjust your dimensions' },
  step3: { eyebrow: 'Step 3 of 4', title: 'Add doors and windows' },
  step4: { eyebrow: 'Step 4 of 4', title: 'Choose your room style' },
  furnish: { eyebrow: 'Furnish', title: 'Furnish the room' },
}

function NameBadge() {
  const name = useStore((s) => s.design.name)
  const setName = useStore((s) => s.setName)
  return (
    <input
      className="name-badge"
      value={name}
      spellCheck={false}
      onChange={(e) => setName(e.target.value)}
      onFocus={(e) => e.target.select()}
    />
  )
}

export function Wizard() {
  const stage = useStore((s) => s.stage) as Exclude<Stage, 'start'>
  const next = useStore((s) => s.next)
  const back = useStore((s) => s.back)
  const setStage = useStore((s) => s.setStage)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const canUndo = useStore((s) => s.past.length > 0)
  const canRedo = useStore((s) => s.future.length > 0)
  const meta = META[stage]
  const [saved, setSaved] = useState(false)

  const onSave = () => {
    saveDesign(useStore.getState().design)
    setSaved(true)
    setTimeout(() => setSaved(false), 1600)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      const st = useStore.getState()
      if ((e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault()
        if (e.shiftKey) st.redo()
        else st.undo()
        return
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault()
        st.redo()
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (st.selectedFurnitureId) {
          st.removeFurniture(st.selectedFurnitureId)
          e.preventDefault()
        } else if (st.selectedOpeningId) {
          st.removeOpening(st.selectedOpeningId)
          e.preventDefault()
        }
      } else if (e.key === 'Escape') {
        st.selectFurniture(null)
        st.selectOpening(null)
        st.setPlacingStyle(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <div className="panel">
        <div className="panel-scroll">
          <p className="eyebrow">{meta.eyebrow}</p>
          <h1 className="title">{meta.title}</h1>
          {stage === 'step1' && <Step1Shape />}
          {stage === 'step2' && <Step2Dimensions />}
          {stage === 'step3' && <Step3Openings />}
          {stage === 'step4' && <Step4Style />}
          {stage === 'furnish' && <Furnish />}
        </div>
        <div className="panel-foot">
          {stage !== 'step1' && (
            <button className="btn btn-ghost" onClick={back}>
              Go back
            </button>
          )}
          {stage !== 'furnish' ? (
            <button className="btn btn-primary" onClick={next}>
              {stage === 'step4' ? 'Design this room' : 'Next'}
            </button>
          ) : (
            <button className="btn btn-primary" onClick={onSave}>
              {saved ? 'Saved ✓' : 'Save design'}
            </button>
          )}
        </div>
      </div>

      <div className="stage">
        <RoomView />
        <NameBadge />
        <div className="vp-tools">
          <button className="home-btn" onClick={undo} disabled={!canUndo} title="Undo (⌘Z)">
            ↶
          </button>
          <button className="home-btn" onClick={redo} disabled={!canRedo} title="Redo (⌘⇧Z)">
            ↷
          </button>
          <button className="home-btn" onClick={() => useStore.getState().fitView()} title="Fit view">
            ⤢
          </button>
          <button className="home-btn" onClick={() => setStage('start')} title="Home">
            ⌂
          </button>
        </div>
        <div className="vp-hint">{HINTS[stage]}</div>
      </div>
    </>
  )
}
