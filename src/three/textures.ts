import * as THREE from 'three'
import { FLOOR_MAP, type FloorTexture } from '../data/materials'

// Procedural floor textures drawn on a canvas — no external image assets.
// Each texture represents `areaCm` square of floor; the floor mesh sets
// texture.repeat = roomSizeCm / areaCm so the scale stays physically real.

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shade(hex: string, amt: number): string {
  const c = new THREE.Color(hex)
  const hsl = { h: 0, s: 0, l: 0 }
  c.getHSL(hsl)
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + amt)))
  return `#${c.getHexString()}`
}

interface Built {
  texture: THREE.CanvasTexture
  areaCm: number
}

const cache = new Map<string, Built>()

function seedOf(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function build(def: FloorTexture): Built {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const rnd = mulberry32(seedOf(def.id))

  let areaCm = 300

  if (def.kind === 'wood') {
    areaCm = def.cell * 14 // ~ a few plank widths across the texture
    ctx.fillStyle = def.base
    ctx.fillRect(0, 0, size, size)
    const plankH = size / 7 // 7 plank rows
    for (let row = 0; row < 7; row++) {
      const y = row * plankH
      // per-plank base tint
      const segs = 2 + Math.floor(rnd() * 2)
      let x = -rnd() * (size / segs)
      while (x < size) {
        const w = size / segs + (rnd() - 0.5) * 60
        const l = shade(def.base, (rnd() - 0.5) * 0.1)
        ctx.fillStyle = l
        ctx.fillRect(x, y, w, plankH)
        // grain lines
        ctx.strokeStyle = shade(def.accent, (rnd() - 0.5) * 0.05)
        ctx.globalAlpha = 0.25
        for (let g = 0; g < 5; g++) {
          ctx.beginPath()
          const gy = y + (g + 0.5) * (plankH / 5) + (rnd() - 0.5) * 4
          ctx.moveTo(x, gy)
          ctx.bezierCurveTo(x + w * 0.33, gy + (rnd() - 0.5) * 5, x + w * 0.66, gy + (rnd() - 0.5) * 5, x + w, gy)
          ctx.stroke()
        }
        ctx.globalAlpha = 1
        x += w
      }
      // seam between planks
      ctx.strokeStyle = shade(def.accent, -0.12)
      ctx.globalAlpha = 0.5
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(size, y)
      ctx.stroke()
      ctx.globalAlpha = 1
    }
  } else if (def.kind === 'tile') {
    const tilesPer = 4
    areaCm = def.cell * tilesPer
    const tp = size / tilesPer
    for (let r = 0; r < tilesPer; r++) {
      for (let c = 0; c < tilesPer; c++) {
        const checker = def.id === 'check-tile' && (r + c) % 2 === 1
        ctx.fillStyle = checker ? def.accent : shade(def.base, (rnd() - 0.5) * 0.04)
        ctx.fillRect(c * tp, r * tp, tp, tp)
        if (def.id === 'marble-tile') {
          ctx.strokeStyle = shade(def.accent, -0.05)
          ctx.globalAlpha = 0.3
          for (let v = 0; v < 4; v++) {
            ctx.beginPath()
            ctx.moveTo(c * tp + rnd() * tp, r * tp)
            ctx.bezierCurveTo(
              c * tp + rnd() * tp, r * tp + tp * 0.4,
              c * tp + rnd() * tp, r * tp + tp * 0.7,
              c * tp + rnd() * tp, r * tp + tp,
            )
            ctx.stroke()
          }
          ctx.globalAlpha = 1
        }
      }
    }
    // grout
    ctx.strokeStyle = shade(def.base, -0.18)
    ctx.lineWidth = 3
    for (let i = 0; i <= tilesPer; i++) {
      ctx.beginPath(); ctx.moveTo(i * tp, 0); ctx.lineTo(i * tp, size); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, i * tp); ctx.lineTo(size, i * tp); ctx.stroke()
    }
  } else {
    // concrete
    areaCm = 500
    ctx.fillStyle = def.base
    ctx.fillRect(0, 0, size, size)
    for (let i = 0; i < 9000; i++) {
      const x = rnd() * size
      const y = rnd() * size
      ctx.fillStyle = shade(def.accent, (rnd() - 0.5) * 0.12)
      ctx.globalAlpha = 0.05
      ctx.fillRect(x, y, 2, 2)
    }
    ctx.globalAlpha = 1
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return { texture, areaCm }
}

export function getFloorTexture(id: string): Built {
  const cached = cache.get(id)
  if (cached) return cached
  const def = FLOOR_MAP[id] ?? FLOOR_MAP['natural-oak']
  const built = build(def)
  cache.set(id, built)
  return built
}

const thumbCache = new Map<string, string>()

/** Data-URL thumbnail of a floor texture for the swatch picker. */
export function getFloorThumb(id: string): string {
  const cached = thumbCache.get(id)
  if (cached) return cached
  const { texture } = getFloorTexture(id)
  const img = texture.image as HTMLCanvasElement
  const url = img.toDataURL('image/png')
  thumbCache.set(id, url)
  return url
}
