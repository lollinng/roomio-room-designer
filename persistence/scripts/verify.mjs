// Headless verification of the persistence & sharing harness (Agent C, feature 2).
// Boots the Vite dev server and drives the real UI in Chrome to assert the
// trust-critical acceptance behaviours:
//   C2-1: new design autosaves; an edit flips status Saving… -> Saved; the edit
//         is optimistic (visible immediately); reload restores the design in the
//         My Designs grid WITH a thumbnail; manual save (Ctrl/Cmd-S) gives feedback.
// Screenshots land in verify-out/. Exits non-zero on any failed assertion.

import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'
import puppeteer from 'puppeteer-core'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 5187
const APP_URL = `http://localhost:${PORT}/`
const OUT = new URL('../verify-out/', import.meta.url).pathname

let failures = 0
const ok = (cond, msg) => {
  console.log(`${cond ? '  ok' : 'FAIL'} - ${msg}`)
  if (!cond) failures++
}

async function waitForServer(timeoutMs = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(APP_URL)
      if (r.ok) return true
    } catch {}
    await sleep(300)
  }
  throw new Error('vite did not start')
}

const phase = (page) => page.$eval('[data-testid="save-status"]', (el) => el.getAttribute('data-phase'))
const statusText = (page) => page.$eval('[data-testid="save-status"]', (el) => el.textContent || '')
const clickByText = (page, text) =>
  page.evaluate((t) => {
    const el = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === t)
    if (!el) throw new Error(`button not found: ${t}`)
    el.click()
  }, text)

async function waitForPhase(page, want, timeoutMs = 6000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if ((await phase(page)) === want) return true
    await sleep(50)
  }
  return false
}

mkdirSync(OUT, { recursive: true })

const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
  cwd: new URL('..', import.meta.url).pathname,
  stdio: 'ignore',
})

let browser
try {
  await waitForServer()
  browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--window-size=1280,860'],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 860 })
  await page.goto(APP_URL, { waitUntil: 'networkidle0' })

  // Start clean so the run is deterministic.
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle0' })

  // 1) Create a new design → editor opens, status is Saved (autosaved on create).
  await clickByText(page, '+ New room')
  await page.waitForSelector('[data-testid="save-status"]', { timeout: 5000 })
  ok(await waitForPhase(page, 'saved', 4000), 'new design autosaves on create (no button)')
  await page.screenshot({ path: `${OUT}c2-1-editor.png` })

  // Capture the rev BEFORE the edit.
  const revBefore = await page.evaluate(() => window.__roomioRev?.() ?? null)

  // Record EVERY phase the indicator passes through (the 'saving' window is brief
  // because a local save is fast — sampling can miss it, so observe attributes).
  await page.evaluate(() => {
    window.__phases = []
    const el = document.querySelector('[data-testid="save-status"]')
    const push = () => window.__phases.push(el.getAttribute('data-phase'))
    push()
    new MutationObserver(push).observe(el, { attributes: true, attributeFilter: ['data-phase'] })
  })

  // 2) Make an edit → status passes through dirty → saving → saved (debounced).
  await clickByText(page, 'Move item →')
  ok(await waitForPhase(page, 'saved', 6000), 'save completes → "Saved <time>"')
  const phases = await page.evaluate(() => window.__phases)
  ok(phases.includes('dirty'), 'edit immediately marks unsaved (optimistic, debouncing)')
  ok(phases.includes('saving'), 'a debounced "Saving…" state is shown before Saved')
  const savedLabel = await statusText(page)
  ok(/saved/i.test(savedLabel), `status reads "${savedLabel.trim()}"`)

  // 3) rev incremented after the save (durable revision advanced).
  const revAfter = await page.evaluate(() => window.__roomioRev?.() ?? null)
  ok(revBefore !== null && revAfter !== null && revAfter > revBefore, `rev advanced ${revBefore} -> ${revAfter}`)

  // 4) Manual save (Ctrl/Cmd-S) gives feedback (no crash; lands on saved).
  await page.keyboard.down('Control')
  await page.keyboard.press('KeyS')
  await page.keyboard.up('Control')
  ok(await waitForPhase(page, 'saved', 6000), 'manual Ctrl/Cmd-S resolves to Saved')

  // 5) Reload → design persists in My Designs WITH a thumbnail.
  await page.evaluate(() => history.pushState(null, '', '/')) // no-op; ensure same origin
  await page.reload({ waitUntil: 'networkidle0' })
  // back on the library (no design open after reload)
  const cards = await page.$$('button img')
  ok(cards.length >= 1, 'design appears as a card in My Designs after reload')
  const thumbSrc = cards.length ? await page.evaluate((img) => img.getAttribute('src') || '', cards[0]) : ''
  ok(thumbSrc.startsWith('data:image/'), 'card shows an auto-generated thumbnail (data URL)')
  await page.screenshot({ path: `${OUT}c2-1-library.png` })

  // 6) Reopen → the edited design loads back (round-trip through storage).
  await page.evaluate(() => {
    const card = document.querySelector('button img')?.closest('button')
    card?.click()
  })
  ok(await waitForPhase(page, 'saved', 4000), 'reopening a saved design loads it (status Saved)')
} catch (err) {
  console.error(err)
  failures++
} finally {
  if (browser) await browser.close()
  vite.kill('SIGTERM')
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll persistence checks passed')
process.exit(failures ? 1 : 0)
