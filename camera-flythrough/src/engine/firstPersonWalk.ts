import * as THREE from 'three'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
import type { SceneHandle, Vec2 } from '../contract/sceneContract'
import { resolveWalk } from './collision'

/**
 * F1 — First-person walk.
 *
 * PointerLockControls for mouse-look + WASD movement at a fixed eye height
 * (~1.6 m), with collision against the live colliders (walls + furniture
 * footprints) so you can't pass through anything. Movement is proposed in world
 * meters, resolved in design cm by the shared footprint solver, then written
 * back — so you slide along walls instead of stopping dead.
 *
 * Owns its OWN camera (never hijacks the user's OrbitControls camera). The host
 * renders `controller.camera` while walk mode is active.
 */

export interface FirstPersonWalkOpts {
  eyeHeight?: number // meters (default 1.6)
  speed?: number // meters/sec (default 2.6)
  bodyRadius?: number // cm (default 18)
}

export class FirstPersonWalk {
  readonly camera: THREE.PerspectiveCamera
  readonly controls: PointerLockControls
  private handle: SceneHandle
  private eyeHeight: number
  private speed: number
  private bodyRadius: number
  private keys = new Set<string>()
  private active = false
  private posCm: Vec2 = { x: 0, z: 0 }
  private fwd = new THREE.Vector3()
  private right = new THREE.Vector3()
  private up = new THREE.Vector3(0, 1, 0)

  /** trajectory samples (world meters [x,y,z]) for F4 walk-and-record */
  private recording = false
  private samples: Array<[number, number, number]> = []
  private sampleAccum = 0
  private sampleInterval = 0.08 // seconds between samples while recording

  constructor(handle: SceneHandle, opts: FirstPersonWalkOpts = {}) {
    this.handle = handle
    this.eyeHeight = opts.eyeHeight ?? 1.6
    this.speed = opts.speed ?? 2.6
    this.bodyRadius = opts.bodyRadius ?? 18
    const aspect = (handle.size?.width ?? 1) / (handle.size?.height ?? 1) || 1
    this.camera = new THREE.PerspectiveCamera(70, aspect, 0.05, 200)
    this.controls = new PointerLockControls(this.camera, handle.domElement)
  }

  private onKeyDown = (e: KeyboardEvent) => this.keys.add(e.code)
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code)

  /** Enter walk mode. Places the camera at `startCm` (cm) or the room center. */
  enable(startCm?: Vec2) {
    if (this.active) return
    this.active = true
    if (this.handle.controls) this.handle.controls.enabled = false
    const f = this.frameFns()
    const start = startCm ?? this.roomCenterCm()
    this.posCm = { ...start }
    const [wx, wz] = f.toWorld(start.x, start.z)
    this.camera.position.set(wx, this.eyeHeight, wz)
    const aspect = (this.handle.size?.width ?? 1) / (this.handle.size?.height ?? 1) || 1
    this.camera.aspect = aspect
    this.camera.updateProjectionMatrix()
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
  }

  /** Request pointer lock (must be from a user gesture, e.g. a click). */
  lock() {
    if (this.active) this.controls.lock()
  }

  disable() {
    if (!this.active) return
    this.active = false
    this.recording = false
    this.keys.clear()
    if (this.controls.isLocked) this.controls.unlock()
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    if (this.handle.controls) this.handle.controls.enabled = true
  }

  isActive() {
    return this.active
  }

  /** Advance one frame. Returns this camera so the host can render it. */
  update(dt: number): THREE.PerspectiveCamera {
    if (!this.active) return this.camera

    // horizontal forward / right from the look direction
    this.camera.getWorldDirection(this.fwd)
    this.fwd.y = 0
    if (this.fwd.lengthSq() < 1e-6) this.fwd.set(0, 0, -1)
    this.fwd.normalize()
    this.right.crossVectors(this.fwd, this.up).normalize()

    let mz = 0
    let mx = 0
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) mz += 1
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) mz -= 1
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) mx += 1
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) mx -= 1

    if (mx !== 0 || mz !== 0) {
      const len = Math.hypot(mx, mz)
      const step = (this.speed * dt) / len
      const dxW = (this.fwd.x * mz + this.right.x * mx) * step
      const dzW = (this.fwd.z * mz + this.right.z * mx) * step
      const f = this.frameFns()
      const proposedCm = f.fromWorld(
        this.camera.position.x + dxW,
        this.camera.position.z + dzW,
      )
      const colliders = this.handle.getColliders?.()
      const resolved = colliders
        ? resolveWalk(this.posCm, { x: proposedCm[0], z: proposedCm[1] }, colliders, {
            radius: this.bodyRadius,
          })
        : { x: proposedCm[0], z: proposedCm[1] }
      this.posCm = resolved
      const [nx, nz] = f.toWorld(resolved.x, resolved.z)
      this.camera.position.set(nx, this.eyeHeight, nz)
    }

    if (this.recording) {
      this.sampleAccum += dt
      if (this.sampleAccum >= this.sampleInterval) {
        this.sampleAccum = 0
        this.samples.push([this.camera.position.x, this.camera.position.y, this.camera.position.z])
      }
    }
    return this.camera
  }

  // --- F4 walk-and-record hooks ---
  startRecording() {
    this.samples = [
      [this.camera.position.x, this.camera.position.y, this.camera.position.z],
    ]
    this.sampleAccum = 0
    this.recording = true
  }
  stopRecording(): Array<[number, number, number]> {
    this.recording = false
    return this.samples.slice()
  }
  isRecording() {
    return this.recording
  }

  private roomCenterCm(): Vec2 {
    const c = this.handle.getColliders?.()
    if (c) return { x: (c.bounds.minX + c.bounds.maxX) / 2, z: (c.bounds.minZ + c.bounds.maxZ) / 2 }
    return { x: 0, z: 0 }
  }

  private frameFns() {
    const fr = this.handle.frame?.() ?? { cx: 0, cz: 0 }
    return {
      toWorld: (x: number, z: number): [number, number] => [(x - fr.cx) / 100, (z - fr.cz) / 100],
      fromWorld: (wx: number, wz: number): [number, number] => [wx * 100 + fr.cx, wz * 100 + fr.cz],
    }
  }
}
