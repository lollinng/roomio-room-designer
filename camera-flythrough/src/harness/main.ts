import * as THREE from 'three'
import { buildScene } from './buildScene'
import { FirstPersonWalk } from '../engine/firstPersonWalk'

/**
 * Dev-harness entry. Wires the flythrough engine to a faithful furnished-room
 * SceneHandle. In production this same engine attaches to Agent A's live scene
 * via getSceneHandle() (see /shared/scene_contract.json) — the engine code is
 * identical; only the source of the SceneHandle differs.
 */

const app = document.getElementById('app')!
const { handle, startLoop } = buildScene(app)

// ---- engine modules ----
const walk = new FirstPersonWalk(handle, { eyeHeight: 1.6 })

type Mode = 'orbit' | 'walk'
let mode: Mode = 'orbit'

// ---- HUD ----
const hud = document.createElement('div')
hud.id = 'hud'
hud.innerHTML = `
  <div class="group">
    <span class="label">View</span>
    <button id="btn-orbit" class="active">Orbit</button>
    <button id="btn-walk">Walk (F1)</button>
  </div>
`
document.body.appendChild(hud)

const banner = document.createElement('div')
banner.id = 'banner'
document.body.appendChild(banner)

const btnOrbit = hud.querySelector<HTMLButtonElement>('#btn-orbit')!
const btnWalk = hud.querySelector<HTMLButtonElement>('#btn-walk')!

function setBanner(html: string) {
  banner.innerHTML = html
}

function setMode(next: Mode) {
  if (next === mode) return
  // tear down current
  if (mode === 'walk') walk.disable()
  mode = next
  btnOrbit.classList.toggle('active', mode === 'orbit')
  btnWalk.classList.toggle('active', mode === 'walk')
  if (mode === 'walk') {
    walk.enable()
    setBanner('<b>Walk mode</b> — click to look around · <b>WASD</b>/arrows to move · <b>Esc</b> to release · collides with walls & furniture')
  } else {
    setBanner('<b>Orbit</b> — drag to rotate, scroll to zoom. Switch to Walk to explore in first person.')
  }
}

btnOrbit.addEventListener('click', () => setMode('orbit'))
btnWalk.addEventListener('click', () => setMode('walk'))

// Click the canvas to (re)acquire pointer lock while walking.
handle.domElement.addEventListener('click', () => {
  if (mode === 'walk') walk.lock()
})

setBanner('<b>Orbit</b> — drag to rotate, scroll to zoom. Switch to Walk to explore in first person.')

// ---- render loop ----
startLoop((dt): THREE.Camera | null => {
  if (mode === 'walk') return walk.update(dt)
  return null
})

// ---- debug hooks for headless verification ----
;(window as unknown as { __fly: unknown }).__fly = {
  setMode,
  getMode: () => mode,
  pressKeys: (codes: string[]) => codes.forEach((c) => window.dispatchEvent(new KeyboardEvent('keydown', { code: c }))),
  releaseKeys: (codes: string[]) => codes.forEach((c) => window.dispatchEvent(new KeyboardEvent('keyup', { code: c }))),
  walkPosCm: () => (walk as unknown as { posCm: { x: number; z: number } }).posCm,
  walkCamPos: () => walk.camera.position.toArray(),
  setWalkYaw: (rad: number) => {
    walk.camera.rotation.set(0, rad, 0)
  },
  colliders: () => handle.getColliders?.(),
}
