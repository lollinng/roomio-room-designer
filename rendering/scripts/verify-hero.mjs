// Headless validation of the G5 hero path-trace integration. SwiftShader is a SOFTWARE GL — true
// path-trace quality/perf needs a real GPU — so this is LENIENT on convergence speed but STRICT on:
//   (1) activating hero mode does not crash; (2) it either path-traces (samples advance) OR gracefully
//   reports unsupported; (3) returning to live (setHeroActive false) restores the raster view.

import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT = join(ROOT, 'verify-out')
const PORT = 5189
const URL = `http://localhost:${PORT}/`
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let failures = 0
const ok = (c, m) => {
  console.log(`  ${c ? 'ok  ' : 'FAIL'} - ${m}`)
  if (!c) failures++
}

const MEAN = `(() => {
  const c = document.querySelector('canvas'); if (!c) return null;
  const o = document.createElement('canvas'); o.width=160; o.height=100;
  const x = o.getContext('2d'); x.drawImage(c,0,0,160,100);
  const d = x.getImageData(0,0,160,100).data; let s=0,dark=0;
  for (let i=0;i<d.length;i+=4){const L=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2];s+=L;if(L<12)dark++;}
  return { mean:s/(160*100), darkFrac:dark/(160*100) };
})()`

async function waitForServer(t = 30000) {
  const start = Date.now()
  while (Date.now() - start < t) {
    try { if ((await fetch(URL)).ok) return } catch {}
    await sleep(300)
  }
  throw new Error('vite did not come up')
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' })
  let browser
  try {
    await waitForServer()
    const puppeteer = (await import('puppeteer-core')).default
    browser = await puppeteer.launch({
      executablePath: CHROME,
      headless: 'new',
      args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--window-size=1280,800'],
    })
    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 })
    const errors = []
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    page.on('pageerror', (e) => errors.push(String(e)))

    await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 })
    await page.waitForSelector('canvas', { timeout: 15000 })
    await page.waitForFunction('!!window.__rendering', { timeout: 10000 })
    await sleep(1500)

    // Lower the sample target so a converged still is reachable even under SwiftShader.
    await page.evaluate('window.__rendering.store.getState().patch({ heroRender: { samples: 8 } })')
    // Activate hero.
    await page.evaluate('window.__rendering.store.getState().setHeroActive(true)')
    await sleep(7000) // BVH build + a few samples (slow in software GL)

    const st = await page.evaluate('(() => { const s = window.__rendering.store.getState(); return { active: s.heroActive, samples: s.heroSamples, supported: s.heroSupported }; })()')
    console.log('     hero state:', JSON.stringify(st))
    writeFileSync(join(OUT, '05-hero.png'), await page.screenshot({ encoding: 'binary' }))

    // STRICT: graceful unsupported OR it actually advanced samples — never a crash/hang.
    ok(st.supported === false || st.samples > 0, st.supported === false ? 'gracefully reported unsupported (no WebGL2)' : `path tracer advanced (${st.samples} samples)`)
    if (st.supported) {
      const heroFrame = await page.evaluate(MEAN)
      ok(heroFrame && heroFrame.mean > 15 && heroFrame.darkFrac < 0.95, `hero frame is not black (mean ${heroFrame?.mean.toFixed(1)})`)
    }

    // Return to live → raster view must render again.
    await page.evaluate('window.__rendering.store.getState().setHeroActive(false)')
    await sleep(1200)
    const live = await page.evaluate(MEAN)
    ok(live && live.mean > 20 && live.darkFrac < 0.9, `raster view restored after hero (mean ${live?.mean.toFixed(1)})`)
    writeFileSync(join(OUT, '06-after-hero.png'), await page.screenshot({ encoding: 'binary' }))

    const realErrors = errors.filter((e) => !/favicon|404|DevTools/i.test(e))
    ok(realErrors.length === 0, `no console errors during hero (${realErrors.length})`)
    if (realErrors.length) realErrors.slice(0, 8).forEach((e) => console.log('     err:', e.slice(0, 220)))
  } finally {
    if (browser) await browser.close()
    vite.kill('SIGTERM')
  }
  console.log(failures === 0 ? '\nHERO OK — screenshots in verify-out/' : `\n${failures} FAILED`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
