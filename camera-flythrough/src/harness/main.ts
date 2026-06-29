import * as THREE from 'three'
import { buildScene } from './buildScene'
import { FirstPersonWalk } from '../engine/firstPersonWalk'
import { DirectorView } from '../engine/directorView'
import { WaypointPath } from '../engine/waypointPath'

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
const path = new WaypointPath(handle, { eyeHeight: 1.6 })

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
  <div class="group" id="grp-path">
    <span class="label">Path</span>
    <span class="label" id="lbl-count">0 pts</span>
    <button id="btn-del">Delete pt</button>
    <button id="btn-clear">Clear</button>
    <button id="btn-lookat">Set look-at</button>
    <button id="btn-lookclear">Auto look</button>
    <span class="label">dwell</span>
    <input id="in-dwell" type="number" min="0" step="0.25" value="0" style="width:54px" />
    <label class="label"><input id="cb-loop" type="checkbox" /> loop</label>
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
const grpPath = hud.querySelector<HTMLDivElement>('#grp-path')!
const lblCount = hud.querySelector<HTMLSpanElement>('#lbl-count')!
const btnDel = hud.querySelector<HTMLButtonElement>('#btn-del')!
const btnClear = hud.querySelector<HTMLButtonElement>('#btn-clear')!
const btnLookAt = hud.querySelector<HTMLButtonElement>('#btn-lookat')!
const btnLookClear = hud.querySelector<HTMLButtonElement>('#btn-lookclear')!
const inDwell = hud.querySelector<HTMLInputElement>('#in-dwell')!
const cbLoop = hud.querySelector<HTMLInputElement>('#cb-loop')!

function setBanner(html: string) {
  banner.innerHTML = html
}

function pathEditable() {
  return mode === 'director' && !director.isPov()
}

function updatePathEditing() {
  if (pathEditable()) {
    path.enableEditing(director.topCamera)
    path.setVisible(true)
  } else {
    path.disableEditing()
    path.setVisible(false)
  }
}

function refreshHud() {
  btnOrbit.classList.toggle('active', mode === 'orbit')
  btnWalk.classList.toggle('active', mode === 'walk')
  btnDirector.classList.toggle('active', mode === 'director')
  grpDirector.style.display = mode === 'director' ? 'flex' : 'none'
  grpPath.style.display = pathEditable() ? 'flex' : 'none'
  btnPov.classList.toggle('active', director.isPov())
  btnPov.textContent = director.isPov() ? '⤢ Top-down' : '⤢ Camera POV'
  btnLookAt.classList.toggle('active', path.isSettingLookAt())
  const info = path.selectedInfo()
  lblCount.textContent = `${path.count()} pts${info ? ` · #${info.index + 1}` : ''}`
  if (info) inDwell.value = String(info.dwell)
}

path.onChange(() => refreshHud())

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
    setBanner('<b>Director (top-down)</b> — click the floor to drop waypoints; a smooth spline connects them. Drag points to reshape. Select a point to set its look-at + dwell.')
  } else {
    setBanner('<b>Orbit</b> — drag to rotate, scroll to zoom.')
  }
  updatePathEditing()
  refreshHud()
}

btnOrbit.addEventListener('click', () => setMode('orbit'))
btnWalk.addEventListener('click', () => setMode('walk'))
btnDirector.addEventListener('click', () => setMode('director'))
btnPov.addEventListener('click', () => {
  const pov = director.togglePov()
  setBanner(pov
    ? '<b>Camera POV</b> — first-person preview of the recording camera. Tap <b>Top-down</b> to return and edit the path.'
    : '<b>Director (top-down)</b> — click the floor to drop waypoints; drag to reshape; set per-point look-at + dwell.')
  updatePathEditing()
  refreshHud()
})

// ---- path tools ----
btnDel.addEventListener('click', () => path.removeSelected())
btnClear.addEventListener('click', () => path.clear())
btnLookAt.addEventListener('click', () => {
  path.beginSetLookAt()
  setBanner('<b>Set look-at</b> — click a spot on the floor for the selected point to face. (Click cancels to a normal waypoint add only after you place it.)')
  refreshHud()
})
btnLookClear.addEventListener('click', () => path.clearLookAt())
inDwell.addEventListener('change', () => path.setDwell(parseFloat(inDwell.value) || 0))
cbLoop.addEventListener('change', () => path.setLoop(cbLoop.checked))

// Click the canvas to (re)acquire pointer lock while walking.
handle.domElement.addEventListener('click', () => {
  if (mode === 'walk') walk.lock()
})
window.addEventListener('resize', () => director.resize())

// start in director mode
director.enable()
setBanner('<b>Director (top-down)</b> — click the floor to drop waypoints; a smooth spline connects them. Drag points to reshape. Select a point to set its look-at + dwell.')
updatePathEditing()
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
  togglePov: () => { const v = director.togglePov(); updatePathEditing(); refreshHud(); return v },
  isPov: () => director.isPov(),
  setRecordingPose: (p: number[], l: number[]) =>
    director.setRecordingPose(new THREE.Vector3(p[0], p[1], p[2]), new THREE.Vector3(l[0], l[1], l[2])),
  // path authoring
  addWaypoint: (x: number, z: number) => path.addPointAt(new THREE.Vector3(x, 1.6, z)),
  dragSelected: (x: number, z: number) => {
    const i = path.selectedIndex()
    if (i < 0) return
    // simulate a drag by removing+reinserting is complex; expose direct set instead
    ;(path as unknown as { waypoints: Array<{ position: THREE.Vector3; marker: THREE.Mesh }> }).waypoints[i].position.set(x, 1.6, z)
    ;(path as unknown as { waypoints: Array<{ position: THREE.Vector3; marker: THREE.Mesh }> }).waypoints[i].marker.position.set(x, 1.6, z)
    ;(path as unknown as { rebuildCurve: () => void }).rebuildCurve()
  },
  select: (i: number) => path.select(i),
  setDwell: (s: number) => path.setDwell(s),
  setLookAtWorld: (x: number, y: number, z: number) => {
    const i = path.selectedIndex()
    if (i < 0) return
    ;(path as unknown as { waypoints: Array<{ lookAt: THREE.Vector3 | null }> }).waypoints[i].lookAt = new THREE.Vector3(x, y, z)
    ;(path as unknown as { rebuildLookLines: () => void }).rebuildLookLines()
  },
  pathCount: () => path.count(),
  hasCurve: () => path.hasCurve(),
  toCameraPath: () => path.toCameraPath(),
  loadCameraPath: (p: unknown) => path.loadCameraPath(p as ReturnType<typeof path.toCameraPath>),
  curveSample: (t: number) => {
    const c = path.getCurve()
    return c ? c.getPointAt(Math.max(0, Math.min(1, t))).toArray() : null
  },
  curveDense: (n: number) => {
    const c = path.getCurve()
    return c ? c.getPoints(n).map((p) => p.toArray()) : null
  },
}
