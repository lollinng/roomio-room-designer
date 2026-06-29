// index.js
// -----------------------------------------------------------------------------
// Roomio backend entry point. Wires up Express, JSON + cookie parsing, all the
// auth and designs routes, a JSON error handler, then boots the DB schema and
// starts listening.
//
// Routes are same-origin from the browser's perspective: the Vite dev server on
// :5180 proxies /api/* here (default :5181), so cookies "just work" with
// SameSite=Lax and no CORS needed. See README for the full API.
// -----------------------------------------------------------------------------

import { randomUUID } from 'node:crypto'
import { readFile, writeFile, rename } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cookieParser from 'cookie-parser'

import { initDb, query } from './db.js'
import {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  clearSessionCookie,
  requireAuth,
  SESSION_COOKIE,
} from './auth.js'

const PORT = process.env.PORT || 5181

// ESM has no __dirname; derive it from import.meta.url. repoRoot is one level up
// from server/ — used to locate shared/requests and shared/results.
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.join(__dirname, '..')

const app = express()
app.use(express.json({ limit: '2mb' }))
// Room photos arrive as base64 data URLs which blow past the 2mb default, so the
// /api/detect POST gets its own larger JSON parser.
app.use('/api/detect', express.json({ limit: '15mb' }))
app.use(cookieParser())

// --- Helpers ----------------------------------------------------------------

/**
 * Wrap an async route handler so any thrown/rejected error is forwarded to the
 * global error handler instead of crashing the process or hanging the request.
 */
const wrap = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next)

// Pragmatic email check: non-empty local part, an @, a dot in the domain.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Convert a Postgres timestamp value to epoch milliseconds (Number). */
const toEpochMs = (ts) => Number(new Date(ts))

/** Shape a user row for API responses (never leak password_hash). */
const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name })

// --- Health -----------------------------------------------------------------

// Unauthenticated smoke-test endpoint.
app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

// --- Auth --------------------------------------------------------------------

// POST /api/auth/signup — create a user + session, set the cookie.
app.post(
  '/api/auth/signup',
  wrap(async (req, res) => {
    const { email, password, name } = req.body || {}

    // Validate inputs.
    if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'invalid email' })
    }
    if (typeof password !== 'string' || password.length < 6) {
      return res
        .status(400)
        .json({ error: 'password must be at least 6 characters' })
    }

    const normalizedEmail = email.trim().toLowerCase()
    const displayName = typeof name === 'string' && name.trim() ? name.trim() : null

    // Reject duplicate emails up front for a friendly 409.
    const existing = await query(`SELECT id FROM users WHERE email = $1`, [
      normalizedEmail,
    ])
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'email already registered' })
    }

    const id = randomUUID()
    const passwordHash = await hashPassword(password)

    // Insert the user. ON CONFLICT guards against a race between the check above
    // and this insert (two concurrent signups with the same email).
    const inserted = await query(
      `INSERT INTO users (id, email, password_hash, name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, email, name`,
      [id, normalizedEmail, passwordHash, displayName]
    )
    if (inserted.rows.length === 0) {
      return res.status(409).json({ error: 'email already registered' })
    }

    const user = inserted.rows[0]
    await createSession(res, user.id)
    res.json({ user: publicUser(user) })
  })
)

// POST /api/auth/login — verify credentials, create a session, set the cookie.
app.post(
  '/api/auth/login',
  wrap(async (req, res) => {
    const { email, password } = req.body || {}

    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'email and password required' })
    }

    const normalizedEmail = email.trim().toLowerCase()
    const { rows } = await query(
      `SELECT id, email, name, password_hash FROM users WHERE email = $1`,
      [normalizedEmail]
    )
    const user = rows[0]

    // Use the same 401 for "no such user" and "bad password" so we don't leak
    // which emails are registered.
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return res.status(401).json({ error: 'invalid credentials' })
    }

    await createSession(res, user.id)
    res.json({ user: publicUser(user) })
  })
)

// POST /api/auth/logout — destroy the session row and clear the cookie.
app.post(
  '/api/auth/logout',
  wrap(async (req, res) => {
    const sid = req.cookies?.[SESSION_COOKIE]
    await destroySession(sid)
    clearSessionCookie(res)
    res.json({ ok: true })
  })
)

// GET /api/auth/me — return the current user, or 401 if not authed.
app.get(
  '/api/auth/me',
  requireAuth,
  wrap(async (req, res) => {
    res.json({ user: publicUser(req.user) })
  })
)

// --- Designs -----------------------------------------------------------------

// GET /api/designs — list this user's designs, newest first (summary shape).
app.get(
  '/api/designs',
  requireAuth,
  wrap(async (req, res) => {
    const { rows } = await query(
      `SELECT id, name, shape, updated_at, created_at
         FROM designs
        WHERE user_id = $1
        ORDER BY updated_at DESC`,
      [req.user.id]
    )
    res.json(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        shape: r.shape,
        updatedAt: toEpochMs(r.updated_at),
        createdAt: toEpochMs(r.created_at),
      }))
    )
  })
)

// GET /api/designs/:id — return the full stored RoomDesign JSON if owned.
app.get(
  '/api/designs/:id',
  requireAuth,
  wrap(async (req, res) => {
    const { rows } = await query(
      `SELECT data FROM designs WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    )
    if (rows.length === 0) {
      return res.status(404).json({ error: 'not found' })
    }
    // `data` is the full RoomDesign JSON exactly as the client stored it.
    res.json(rows[0].data)
  })
)

// POST /api/designs — upsert a full RoomDesign owned by the current user.
app.post(
  '/api/designs',
  requireAuth,
  wrap(async (req, res) => {
    const design = req.body
    if (!design || typeof design !== 'object' || typeof design.id !== 'string') {
      return res.status(400).json({ error: 'design with string id required' })
    }

    // Guard ownership: if a row with this id already exists under a *different*
    // user, refuse rather than overwrite someone else's design.
    const owner = await query(`SELECT user_id FROM designs WHERE id = $1`, [
      design.id,
    ])
    if (owner.rows.length > 0 && owner.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'forbidden' })
    }

    const name = typeof design.name === 'string' ? design.name : null
    const shape = typeof design.shape === 'string' ? design.shape : null

    // Upsert by primary key. The WHERE on the DO UPDATE is a belt-and-suspenders
    // re-check of ownership in case of a concurrent insert by another user.
    await query(
      `INSERT INTO designs (id, user_id, name, shape, data, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (id) DO UPDATE
         SET name = EXCLUDED.name,
             shape = EXCLUDED.shape,
             data = EXCLUDED.data,
             updated_at = now()
       WHERE designs.user_id = $2`,
      [design.id, req.user.id, name, shape, design]
    )

    res.json({ ok: true, id: design.id })
  })
)

// DELETE /api/designs/:id — delete the design if owned by the current user.
app.delete(
  '/api/designs/:id',
  requireAuth,
  wrap(async (req, res) => {
    await query(`DELETE FROM designs WHERE id = $1 AND user_id = $2`, [
      req.params.id,
      req.user.id,
    ])
    // Idempotent: deleting a missing/unowned design still returns ok.
    res.json({ ok: true })
  })
)

// --- Detection (scan a room photo) -------------------------------------------
//
// Suggestion-only furniture detection. Agent A POSTs a room photo; we drop the
// bytes + a sidecar request file into shared/requests/ for Agent B's Python
// watcher to pick up. The watcher writes shared/results/<id>.result.json, which
// the client polls for via GET. These routes are intentionally unauthenticated.

const REQUESTS_DIR = path.join(repoRoot, 'shared', 'requests')
const RESULTS_DIR = path.join(repoRoot, 'shared', 'results')

// Only simple, filesystem-safe ids — defends the GET against path traversal.
const ID_RE = /^[A-Za-z0-9_-]+$/

/** Strip an optional "data:image/...;base64," prefix and return the raw base64. */
const stripDataUrlPrefix = (s) => s.replace(/^data:[^;,]*;base64,/, '').replace(/^data:[^,]*,/, '')

// POST /api/detect — accept a room photo, queue it for detection, return its id.
app.post(
  '/api/detect',
  wrap(async (req, res) => {
    const { imageBase64 } = req.body || {}
    if (typeof imageBase64 !== 'string' || imageBase64.trim() === '') {
      return res.status(400).json({ error: 'imageBase64 required' })
    }

    const raw = stripDataUrlPrefix(imageBase64.trim())
    let bytes
    try {
      bytes = Buffer.from(raw, 'base64')
    } catch {
      return res.status(400).json({ error: 'invalid base64 image' })
    }
    if (bytes.length === 0) {
      return res.status(400).json({ error: 'invalid base64 image' })
    }

    const id = randomUUID()
    const imageRel = `shared/requests/${id}.jpg`
    const imagePath = path.join(REQUESTS_DIR, `${id}.jpg`)
    const sidecarPath = path.join(REQUESTS_DIR, `${id}.request.json`)

    // Write via tmp + rename so the watcher never observes a half-written file.
    const imageTmp = `${imagePath}.tmp`
    await writeFile(imageTmp, bytes)
    await rename(imageTmp, imagePath)

    const sidecarTmp = `${sidecarPath}.tmp`
    await writeFile(
      sidecarTmp,
      JSON.stringify({ request_id: id, image_path: imageRel }),
    )
    await rename(sidecarTmp, sidecarPath)

    res.json({ request_id: id })
  })
)

// GET /api/detect/:id — poll for a detection result. Pending until the watcher
// writes the result file; returns the result JSON verbatim once it exists.
app.get(
  '/api/detect/:id',
  wrap(async (req, res) => {
    const { id } = req.params
    if (!ID_RE.test(id)) {
      return res.status(400).json({ error: 'invalid id' })
    }

    const resultPath = path.join(RESULTS_DIR, `${id}.result.json`)
    let text
    try {
      text = await readFile(resultPath, 'utf8')
    } catch {
      // No result file yet — detection still in progress (or never queued).
      return res.json({ status: 'pending' })
    }

    try {
      return res.json(JSON.parse(text))
    } catch {
      // File may be mid-write (watcher not using tmp+rename) — treat as pending.
      return res.json({ status: 'pending' })
    }
  })
)

// --- Fallbacks & error handling ---------------------------------------------

// Unknown /api route -> JSON 404 (so the SPA proxy never gets HTML for API calls).
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'not found' })
})

// Global error handler: any error thrown in a wrapped handler lands here and
// becomes a JSON 500 instead of crashing the process.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[roomio] unhandled error:', err)
  if (res.headersSent) return
  res.status(500).json({ error: 'internal server error' })
})

// --- Boot --------------------------------------------------------------------

// Initialize the schema, then start listening. Fail loudly if the DB is
// unreachable so we don't serve a half-initialized server.
initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[roomio] server listening on http://localhost:${PORT}`)
    })
  })
  .catch((err) => {
    console.error('[roomio] failed to initialize database:', err)
    process.exit(1)
  })
