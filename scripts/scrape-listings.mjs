/**
 * Roomio flat-listings pipeline (no-broker listings).
 *
 * Scrapes a Facebook flatmate GROUP via a logged-in MEMBER session (cookies, never
 * a password) and writes a recency-sorted listings JSON the Roomio app loads at
 * /listings.json.
 *
 * Two-stage, matching how the group actually works:
 *   1) FEED PASS — read the group feed, collect each post's text + permalink + author,
 *      in feed order (newest first). Classify OFFERING (someone posting a flat) vs
 *      SEEKING (someone asking for one). We KEEP offering, DROP seeking.
 *   2) ENRICH PASS — open each kept post's PERMALINK page (not virtualized, so media
 *      renders reliably) and pull photos, video, and the timestamp.
 *
 * Per listing: text, author, phones (shown OPENLY + as a Call button), photos, video,
 * and parsed rent / BHK / location / gender / occupancy.
 *
 * ⚠️ Logged-in scraping (against Meta ToS). Use a DEDICATED burner that is a MEMBER of
 * the group; keep cookies out of git; run infrequently.
 *
 * Usage:
 *   FB_COOKIES=./scripts/fb-cookies.txt \
 *   GROUP_URL=https://www.facebook.com/groups/1792860891038652 \
 *   node scripts/scrape-listings.mjs
 *
 * Env: FB_COOKIES (required) · GROUP_URL · OUT (default public/listings.json) ·
 *      MAX_SCROLLS (12) · MAX_ENRICH (30) · CHROME_PATH · HEADLESS=0 to watch.
 */
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'
import { extractPhones, parseListing } from './lib/parse-listing.mjs'

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const GROUP = process.env.GROUP_URL || 'https://www.facebook.com/groups/1792860891038652'
const OUT = process.env.OUT || 'public/listings.json'
const COOKIES_PATH = process.env.FB_COOKIES
const MAX_SCROLLS = Number(process.env.MAX_SCROLLS || 12)
const MAX_ENRICH = Number(process.env.MAX_ENRICH || 30)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

if (!COOKIES_PATH || !fs.existsSync(COOKIES_PATH)) {
  console.error('Set FB_COOKIES to a cookies file (Netscape cookies.txt or JSON) from a member burner account.')
  process.exit(2)
}

function loadCookies(p) {
  const raw = fs.readFileSync(p, 'utf8')
  if (raw.trimStart().startsWith('[')) {
    return JSON.parse(raw)
      .filter((c) => /facebook\.com$/.test((c.domain || '.facebook.com').replace(/^\./, '')))
      .map((c) => ({ name: c.name, value: c.value, domain: c.domain || '.facebook.com', path: c.path || '/' }))
  }
  const out = []
  for (let line of raw.split(/\r?\n/)) {
    if (line.startsWith('#HttpOnly_')) line = line.slice(10)
    else if (line.startsWith('#') || !line.trim()) continue
    const f = line.split('\t')
    if (f.length < 7 || !/facebook\.com$/.test(f[0].replace(/^\./, ''))) continue
    const c = { name: f[5], value: f[6], domain: f[0], path: f[2] || '/', secure: f[3] === 'TRUE' }
    if (Number(f[4]) > 0) c.expires = Number(f[4])
    out.push(c)
  }
  return out
}

const cookies = loadCookies(COOKIES_PATH)
if (!cookies.some((c) => c.name === 'c_user') || !cookies.some((c) => c.name === 'xs')) {
  console.error('Cookies missing c_user/xs — not an authenticated session.')
  process.exit(2)
}

const groupId = (GROUP.match(/groups\/([^/?]+)/) || [])[1] || 'group'
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: process.env.HEADLESS === '0' ? false : 'new',
  args: ['--no-sandbox', '--disable-blink-features=AutomationControlled', '--lang=en-US', '--window-size=1400,2400'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1400, height: 2400 })
await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })
await page.setCookie(...cookies)

// ── Stage 1: feed pass ──────────────────────────────────────────────────────
await page.goto(GROUP.replace(/\/$/, '') + '/?locale=en_US', { waitUntil: 'networkidle2', timeout: 60000 })
await sleep(5000)
const status = await page.evaluate(() => ({
  loginWall: /Log in to continue|You must log in/i.test(document.body.innerText) && !!document.querySelector('input[name="pass"]'),
  joinBtn: [...document.querySelectorAll('[role="button"],a')].some((e) => /^(Join group|Request to join)$/i.test((e.innerText || '').trim())),
}))
if (status.loginWall) { console.error('LOGIN_WALL — cookies invalid/expired.'); await browser.close(); process.exit(3) }
if (status.joinBtn) console.error('WARNING: account is not a MEMBER — content may be missing.')

function collectFeed() {
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim()
  const out = []
  for (const el of document.querySelectorAll('[data-ad-rendering-role="story_message"], [data-ad-comet-preview="message"]')) {
    const text = norm(el.innerText)
    if (text.length < 15) continue
    // permalink/post-id: climb ancestors searching each subtree, but STOP before an
    // ancestor spans >1 post (that would grab a neighbour's link). Any /posts/<id> or
    // /permalink/<id> href gives this post's id — a comment link carries it too.
    const container = el.closest('[role="article"]') || el.parentElement
    let id = null, permalink = null
    for (let up = 0, node = el; up < 25 && node; up++, node = node.parentElement) {
      if (node.querySelectorAll?.('[data-ad-rendering-role="story_message"]').length > 1) break
      const href = [...(node.querySelectorAll?.('a[href*="/posts/"], a[href*="/permalink/"]') || [])]
        .map((a) => a.href).find((h) => /\/(?:posts|permalink)\/\d+/.test(h))
      if (href) { id = href.match(/\/(?:posts|permalink)\/(\d+)/)[1]; permalink = href.split('?')[0].replace(/\/permalink\//, '/posts/'); break }
    }
    const author = norm(container.querySelector?.('h2 a, h3 a, strong a, a[href*="/user/"]')?.innerText) || null
    out.push({ key: id || 't:' + text.slice(0, 60), postId: id, permalink, author, text: text.slice(0, 1500) })
  }
  return out
}

const feed = new Map()
;(await page.evaluate(collectFeed)).forEach((p) => feed.has(p.key) || feed.set(p.key, { ...p, seq: feed.size }))
for (let i = 0; i < MAX_SCROLLS; i++) {
  await page.evaluate(() => window.scrollBy(0, 1300))
  await sleep(2200)
  ;(await page.evaluate(collectFeed)).forEach((p) => {
    const cur = feed.get(p.key)
    if (!cur) feed.set(p.key, { ...p, seq: feed.size })
    else if (p.text.length > cur.text.length) Object.assign(cur, { text: p.text, permalink: cur.permalink || p.permalink, postId: cur.postId || p.postId, author: cur.author || p.author })
  })
}

// classify: DROP people asking for a place; ENRICH the rest (offering + ambiguous),
// then keep whatever turns out to be a real listing (has photos, or clearly offering).
const all = [...feed.values()].map((p) => ({ ...p, phones: extractPhones(p.text), ...parseListing(p.text) }))
const candidates = all.filter((p) => p.kind !== 'seeking' && p.permalink).slice(0, MAX_ENRICH)
console.log(`Feed: ${all.length} posts · offering ${all.filter((p) => p.kind === 'offering').length} · seeking(dropped) ${all.filter((p) => p.kind === 'seeking').length} · ambiguous ${all.filter((p) => !p.kind).length} → enriching ${candidates.length}`)

// ── Stage 2: enrich each candidate from its permalink page ───────────────────
const targets = candidates
for (const [i, post] of targets.entries()) {
  try {
    await page.goto(post.permalink + '?locale=en_US', { waitUntil: 'networkidle2', timeout: 45000 })
    await sleep(3500)
    const media = await page.evaluate(() => {
      const norm = (s) => (s || '').replace(/\s+/g, ' ').trim()
      const photos = [...new Set(
        [...document.querySelectorAll('img')]
          .filter((im) => /scontent/.test(im.src) && !/emoji/.test(im.src) && !im.closest('a[href*="/user/"]'))
          .map((im) => im.src),
      )]
      // dedupe by photo id (…/<digits>_…), keep first-seen order
      const byId = new Map()
      for (const src of photos) { const id = (src.match(/\/(\d{6,})_/) || [])[1] || src; if (!byId.has(id)) byId.set(id, src) }
      const images = [...byId.values()].slice(0, 10)
      const vEl = document.querySelector('video')
      const video = vEl ? { thumb: vEl.getAttribute('poster') || images[0] || null, src: /^https?:/.test(vEl.src) ? vEl.src : null } : null
      // timestamp: first date-ish aria-label/title/text near the post header
      let time = null
      for (const a of document.querySelectorAll('a[href*="/posts/"], a[href*="/permalink/"], abbr')) {
        const s = norm(a.getAttribute('aria-label') || a.getAttribute('title') || a.innerText)
        if (/\b20\d\d\b|hour|minute|\bday\b|yesterday|just now|\bmin\b|ago/i.test(s)) { time = s; break }
      }
      // full (un-truncated) post text from the permalink page
      const story = document.querySelector('[data-ad-rendering-role="story_message"], [data-ad-comet-preview="message"]')
      const text = story ? norm(story.innerText) : null
      return { images, video, time, text }
    })
    post.images = media.images
    post.video = media.video
    post.postedAbs = media.time
    // the permalink page has the FULL text (no "See more") → better phones/details
    if (media.text && media.text.length > post.text.length) {
      post.text = media.text.slice(0, 2000)
      post.phones = extractPhones(post.text)
      const p2 = parseListing(post.text)
      for (const k of ['rent', 'bhk', 'location', 'gender', 'occupancy']) if (p2[k] != null) post[k] = p2[k]
    }
    process.stdout.write(`  enriched ${i + 1}/${targets.length}: ${media.images.length} photos${media.video ? ' +video' : ''}\r`)
  } catch (e) {
    post.images = post.images || []
    post.video = post.video || null
  }
}
console.log('')

// ── Write ───────────────────────────────────────────────────────────────────
// a real listing = has photos (offering posts carry flat pics) OR is clearly offering
const kept = targets.filter((p) => (p.images && p.images.length) || p.kind === 'offering')
console.log(`Kept ${kept.length} listings (dropped ${targets.length - kept.length} photo-less ambiguous posts)`)
const listings = kept
  .sort((a, b) => a.seq - b.seq) // feed order = newest first
  .map((p) => ({
    id: p.key,
    postId: p.postId,
    permalink: p.permalink,
    author: p.author,
    text: p.text,
    phones: p.phones,
    rent: p.rent,
    bhk: p.bhk,
    location: p.location,
    gender: p.gender,
    occupancy: p.occupancy,
    images: p.images || [],
    video: p.video || null,
    hasVideo: !!p.video,
    hasImages: (p.images || []).length > 0,
    postedAbs: p.postedAbs || null,
    seq: p.seq,
  }))

const outPath = path.resolve(OUT)
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, JSON.stringify({ group: { id: groupId, url: GROUP.replace(/\/$/, '') }, scrapedAt: new Date().toISOString(), count: listings.length, listings }, null, 2))
console.log(`Wrote ${listings.length} listings → ${outPath}`)
console.log(`  with photos: ${listings.filter((l) => l.hasImages).length} · with video: ${listings.filter((l) => l.hasVideo).length} · with phone: ${listings.filter((l) => l.phones.length).length}`)
await browser.close()
