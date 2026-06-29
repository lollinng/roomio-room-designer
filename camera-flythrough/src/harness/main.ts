import * as THREE from 'three'
import { buildScene } from './buildScene'
import { FirstPersonWalk } from '../engine/firstPersonWalk'
import { DirectorView } from '../engine/directorView'

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
const director = new DirectorView(handle)

type Mode = 'orbit' | 'walk' | 'director'
let mode: Mode = 'director'

// ---- HUD ----
const hud = document.createElement('div')
hud.id = 'hud'
hud.innerHTML = `
  <div class="group">
    <span class="label">View</span>
    <button id="btn-director" class="active">Director (F2)</button>
    <button id="btn-walk">Walk (F1)</button>
    <button id="btn-orbit">Orbit</button>
  </div>
  <div class="group" id="grp-director">
    <button id="btn-pov">⤢ Camera POV</button>
  </div>
`
document.body.appendChild(hud)

const banner = document.createElement('div')
banner.id = 'banner'
document.body.appendChild(banner)

const btnOrbit = hud.querySelector<HTMLButtonElement>('#btn-orbit')!
const btnWalk = hud.querySelector<HTMLButtonElement>('#btn-walk')!
const btnDirector = hud.querySelector<HTMLButtonElement>('#btn-director')!
const btnPov = hud.querySelector<HTMLButtonElement>('#btn-pov')!
const grpDirector = hud.querySelector<HTMLDivElement>('#grp-director')!

function setBanner(html: string) {
  banner.innerHTML = html
}

function refreshHud() {
  btnOrbit.classList.toggle('active', mode === 'orbit')
  btnWalk.classList.toggle('active', mode === 'walk')
  btnDirector.classList.toggle('active', mode === 'director')
  grpDirector.style.display = mode === 'director' ? 'flex' : 'none'
  btnPov.classList.toggle('active', director.isPov())
  btnPov.textContent = director.isPov() ? '⤢ Top-down' : '⤢ Camera POV'
}

function setMode(next: Mode) {
  if (next === mode) return
  if (mode === 'walk') walk.disable()
  if (mode === 'director') director.disable()
  mode = next
  if (mode === 'walk') {
    walk.enable()
    setBanner('<b>Walk mode</b> — click to look around · <b>WASD</b>/arrows to move · <b>Esc</b> to release · collides with walls & furniture')
  } else if (mode === 'director') {
    director.enable()
    setBanner('<b>Director (top-down)</b> — the orange gizmo is the recording camera. Tap <b>Camera POV</b> to see exactly what it will record.')
  } else {
    setBanner('<b>Orbit</b> — drag to rotate, scroll to zoom.')
  }
  refreshHud()
}

btnOrbit.addEventListener('click', () => setMode('orbit'))
btnWalk.addEventListener('click', () => setMode('walk'))
btnDirector.addEventListener('click', () => setMode('director'))
btnPov.addEventListener('click', () => {
  const pov = director.togglePov()
  setBanner(pov
    ? '<b>Camera POV</b> — first-person preview of the recording camera. Tap <b>Top-down</b> to return and adjust.'
    : '<b>Director (top-down)</b> — the orange gizmo is the recording camera. Tap <b>Camera POV</b> to preview.')
  refreshHud()
})

// Click the canvas to (re)acquire pointer lock while walking.
handle.domElement.addEventListener('click', () => {
  if (mode === 'walk') walk.lock()
})
window.addEventListener('resize', () => director.resize())

// start in director mode
director.enable()
setBanner('<b>Director (top-down)</b> — the orange gizmo is the recording camera. Tap <b>Camera POV</b> to see exactly what it will record.')
refreshHud()

// ---- render loop ----
startLoop((dt): THREE.Camera | null => {
  if (mode === 'walk') return walk.update(dt)
  if (mode === 'director') {
    director.syncGizmo()
    return director.activeCamera()
  }
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
  togglePov: () => director.togglePov(),
  isPov: () => director.isPov(),
  setRecordingPose: (p: number[], l: number[]) =>
    director.setRecordingPose(new THREE.Vector3(p[0], p[1], p[2]), new THREE.Vector3(l[0], l[1], l[2])),
}
