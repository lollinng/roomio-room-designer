/**
 * Browser export glue (brief §5). Produces REAL downloadable artifacts:
 *   - image snapshot  → PNG of the top-down plan
 *   - shopping list   → CSV (+ copy-to-clipboard text)
 *   - floor-plan PDF  → single-page PDF embedding the plan + a title/dimensions block
 * The flythrough VIDEO is Agent B's (camera_path + F6 MP4 exporter) — not rebuilt here.
 *
 * All DOM/canvas access is guarded so importing this module is safe off-DOM.
 */
import type { RoomioDesign } from '../envelope/types'
import type { House } from '../scene/slices'
import { renderFloorplan } from '../render/floorplan'
import { buildShoppingList, shoppingListToCSV, shoppingListToText } from './shoppingList'
import { pdfFromJpeg } from './pdf'
import { triggerDownload, safeFileBase } from '../envelope/serialize'

/** Render the house top-down into a fresh canvas at the given pixel size. */
function renderHouseToCanvas(
  house: House,
  width: number,
  height: number,
  opts: { labels?: boolean; furniture?: boolean } = {},
): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  renderFloorplan(ctx, house, {
    width,
    height,
    labels: opts.labels ?? true,
    furniture: opts.furniture ?? true,
    background: '#ffffff',
  })
  return canvas
}

/** Decode a base64 data URL into raw bytes. */
function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',')
  const b64 = dataUrl.slice(comma + 1)
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** Image snapshot → high-res PNG download. */
export function exportImagePNG(design: RoomioDesign): boolean {
  const canvas = renderHouseToCanvas(design.scene.house, 1600, 1100, { labels: true })
  if (!canvas) return false
  const url = canvas.toDataURL('image/png')
  triggerDownload(dataUrlToBlob(url), `${safeFileBase(design.name)}.png`, 'image/png')
  return true
}

/** Shopping list → CSV download. */
export function exportShoppingCSV(design: RoomioDesign): boolean {
  const rows = buildShoppingList(design.scene.house)
  const csv = shoppingListToCSV(rows)
  triggerDownload(csv, `${safeFileBase(design.name)}-shopping-list.csv`, 'text/csv')
  return true
}

/** Shopping list → plain text (for copy-to-clipboard previews). */
export function shoppingListText(design: RoomioDesign): string {
  return shoppingListToText(buildShoppingList(design.scene.house), `${design.name} — shopping list`)
}

/** Floor-plan PDF → single-page PDF embedding the top-down plan + title/dimensions. */
export function exportFloorPlanPDF(design: RoomioDesign): boolean {
  // Higher pixel density than the page points so the embedded image is crisp.
  const canvas = renderHouseToCanvas(design.scene.house, 1600, 1100, { labels: true })
  if (!canvas) return false
  const jpegUrl = canvas.toDataURL('image/jpeg', 0.92)
  const jpeg = dataUrlToBytes(jpegUrl)
  const house = design.scene.house
  const rooms = house.rooms.length
  const dims = house.rooms
    .map((r) => `${r.interior.name || r.type} ${Math.round(r.footprint.w)}×${Math.round(r.footprint.l)}cm`)
    .join('   ·   ')
  const pdf = pdfFromJpeg(jpeg, canvas.width, canvas.height, {
    title: `${design.name} — Floor plan`,
    subtitle: `${rooms} room${rooms === 1 ? '' : 's'}   ·   ${dims}`.slice(0, 180),
  })
  triggerDownload(bytesToBlob(pdf, 'application/pdf'), `${safeFileBase(design.name)}-floor-plan.pdf`, 'application/pdf')
  return true
}

function bytesToBlob(bytes: Uint8Array, mime: string): Blob {
  // Cast: newer TS lib types Uint8Array over ArrayBufferLike; Blob wants ArrayBuffer-backed.
  return new Blob([bytes as unknown as BlobPart], { type: mime })
}

function dataUrlToBlob(dataUrl: string): Blob {
  const mime = /data:([^;]+)/.exec(dataUrl)?.[1] ?? 'application/octet-stream'
  return bytesToBlob(dataUrlToBytes(dataUrl), mime)
}
