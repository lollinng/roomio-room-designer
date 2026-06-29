import type { CameraView } from '../types'

// Tiny bus so the React UI (Wizard "Save") can read the live 3D camera view
// without coupling to the Three.js scene. RoomView registers a capturer on mount.

let capturer: () => CameraView | null = () => null

export function setViewCapturer(fn: () => CameraView | null) {
  capturer = fn
}

export function captureView(): CameraView | null {
  return capturer()
}
