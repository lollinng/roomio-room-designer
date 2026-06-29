import puppeteer from 'puppeteer-core'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = 'http://localhost:5180'

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1680,1000'],
})
let fails = 0
const check = (n, ok, e = '') => (ok ? console.log('  ✓', n) : (fails++, console.log('  ✗', n, e)))

const page = await browser.newPage()
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
await page.goto(BASE, { waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 1200))

const email = `e2e${Date.now()}@roomio.test`
const password = 'secret123'

// Drive auth + repository directly through the app's modules via the dev store + fetch.
const signup = await page.evaluate(async (email, password) => {
  const r = await fetch('/api/auth/signup', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name: 'E2E' }),
  })
  return { status: r.status, body: await r.json() }
}, email, password)
check('signup returns user', signup.status === 200 && signup.body.user?.email === email, JSON.stringify(signup))

// me
const me = await page.evaluate(async () => {
  const r = await fetch('/api/auth/me', { credentials: 'include' })
  return { status: r.status, body: await r.json() }
})
check('me authed after signup', me.status === 200, JSON.stringify(me))

// Save a design through the server
const design = {
  id: 'e2e-room-1',
  name: 'E2E Living Room',
  unit: 'ft',
  shape: 'l',
  corners: [{ x: 0, z: 0 }, { x: 600, z: 0 }, { x: 600, z: 400 }, { x: 0, z: 400 }],
  wallHeight: 270,
  wallThickness: 12,
  openings: [],
  materials: { wallColor: '#f4f1ea', floorTexture: 'walnut' },
  furniture: [{ id: 'f1', archetype: 'sofa-3', category: 'sofa', name: 'Sofa', x: 300, z: 320, rotation: 0, w: 210, d: 92, h: 84, color: '#7d8a99', locked: true }],
  createdAt: 1, updatedAt: 1,
}
const save = await page.evaluate(async (d) => {
  const r = await fetch('/api/designs', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) })
  return { status: r.status, body: await r.json() }
}, design)
check('save design to server', save.status === 200 && save.body.ok, JSON.stringify(save))

// List
const list = await page.evaluate(async () => {
  const r = await fetch('/api/designs', { credentials: 'include' })
  return r.json()
})
check('server lists the saved design', Array.isArray(list) && list.some((d) => d.id === 'e2e-room-1'), JSON.stringify(list))

// Logout
const logout = await page.evaluate(async () => {
  const r = await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
  return r.status
})
check('logout ok', logout === 200)
const meAfter = await page.evaluate(async () => (await fetch('/api/auth/me', { credentials: 'include' })).status)
check('me 401 after logout', meAfter === 401, `status=${meAfter}`)

// Login again
const login = await page.evaluate(async (email, password) => {
  const r = await fetch('/api/auth/login', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
  return r.status
}, email, password)
check('login again ok', login === 200)

// Reopen the design — full scene graph round-trips through Postgres
const reopened = await page.evaluate(async () => {
  const r = await fetch('/api/designs/e2e-room-1', { credentials: 'include' })
  return { status: r.status, body: await r.json() }
})
const d = reopened.body
check(
  'reopen restores full scene graph from PG',
  reopened.status === 200 && d.shape === 'l' && d.furniture?.length === 1 && d.furniture[0].locked === true && d.materials.floorTexture === 'walnut',
  JSON.stringify(d).slice(0, 200),
)

// cleanup
await page.evaluate(async () => fetch('/api/designs/e2e-room-1', { method: 'DELETE', credentials: 'include' }))

check('no page errors', errs.length === 0, errs.join(' | '))

console.log(`\n==== auth/persistence: ${fails === 0 ? 'ALL PASSED ✓' : fails + ' failed ❌'} ====`)
await browser.close()
process.exit(fails ? 1 : 0)
