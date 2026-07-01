// Re-shoot README screenshots from a CLEAN origin/main build (worktree :5185) at retina 2x, with
// the photorealistic rendering ON, and REPLACE the stale flat-rendered versions in docs/screenshots/.
// Per-shot try/catch: a failure keeps the old shot (never publish a broken/empty image).
import { mkdirSync, writeFileSync } from 'node:fs'
import puppeteer from 'puppeteer-core'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = process.env.BASE || 'http://localhost:5185'
const OUT = process.env.OUT
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
mkdirSync(OUT, { recursive: true })
// DSF 2 with a 1512x950 viewport => full = 3024x1900; viewport crop (x430,w1080) => 2160x1900. Matches existing.
const CROP = { x: 430, y: 0, width: 1080, height: 950 }
const results = []

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--window-size=1520,980'] })
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1512, height: 950, deviceScaleFactor: 2 })
  await page.goto(`${BASE}/?stage=furnish&seed=1`, { waitUntil: 'networkidle0', timeout: 45000 })
  await sleep(3500)

  const loadPreset = (g) => page.evaluate(async (gg) => {
    let ps = []; try { const j = await (await fetch('/src/data/personas.json')).json(); ps = Array.isArray(j) ? j : (j.personas || []) } catch {}
    const p = ps.find((x) => (x.genre_id || x.id) === gg) || null
    if (p) { window.__roomio.getState().loadPreset(p); return window.__roomio.getState().design.furniture.length }
    return -1
  }, g)
  const clean = () => page.evaluate(() => {
    const st = window.__roomio.getState(); if (st.selectFurniture) st.selectFurniture(null); if (st.selectOpening) st.selectOpening(null)
  })
  const hi = () => page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === 'high'); if (b) b.click() })
  const collapseRender = () => page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => /^🎬?\s*Render/.test((b.textContent || '').trim()) && b.getAttribute('aria-expanded') === 'true')
    if (btn) btn.click()
  })

  async function shot(name, { genre, full = false, collapse = true } = {}) {
    try {
      if (genre) { const n = await loadPreset(genre); if (n <= 0) throw new Error(`preset ${genre} empty (${n})`); await sleep(2600) }
      await clean(); await hi(); if (collapse) await collapseRender(); await sleep(1500)
      const buf = await page.screenshot({ encoding: 'binary', ...(full ? {} : { clip: CROP }) })
      writeFileSync(`${OUT}/${name}.png`, buf)
      results.push(`OK  ${name} (${full ? 'full 3024x1900' : 'crop 2160x1900'})`)
    } catch (e) { results.push(`FAIL ${name}: ${e.message}`) }
  }

  // (biophilic already captured from clean main.) Personas + hero + lighting.
  await shot('uc-persona-gamer', { genre: 'gamer', collapse: true })
  // Hero — a rich, glam room, both the full-app hero and the 3D-only crop
  await shot('uc-hero', { genre: 'neo_deco', full: true, collapse: true })
  await shot('uc-hero-3d', { genre: 'neo_deco', full: false, collapse: true }) // reuse loaded neo_deco
  // Lighting — furnished room with the render/lighting panel VISIBLE (don't collapse)
  await shot('uc-lighting', { genre: 'celestial', full: true, collapse: false })
} finally { await browser.close() }
console.log(results.join('\n'))
console.log('\nstaged in', OUT)
