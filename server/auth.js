// auth.js
// -----------------------------------------------------------------------------
// Authentication primitives for the Roomio backend:
//   - password hashing/verification (bcryptjs, 10 rounds)
//   - session lifecycle (create / lookup / destroy) backed by the `sessions`
//     table, expressed as an httpOnly cookie named `roomio_sid`
//   - the requireAuth middleware that gates the protected routes
//
// Sessions live for 30 days. The cookie is SameSite=Lax and httpOnly so it
// survives the Vite dev proxy (same-origin from the browser's point of view)
// while staying invisible to client JS. It is intentionally NOT `secure` so it
// works over plain http in local dev.
// -----------------------------------------------------------------------------

import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'

import { query } from './db.js'

// Cookie name and lifetime shared by everything below.
export const SESSION_COOKIE = 'roomio_sid'
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
const SESSION_TTL_SECONDS = SESSION_TTL_MS / 1000 // for cookie Max-Age

// Cookie options used consistently when setting and clearing the session cookie.
// `secure: false` is deliberate for local http dev (see header note).
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: false,
  path: '/',
}

// --- Passwords --------------------------------------------------------------

/** Hash a plaintext password with bcrypt (10 rounds). */
export async function hashPassword(plain) {
  return bcrypt.hash(plain, 10)
}

/** Verify a plaintext password against a stored bcrypt hash. */
export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash)
}

// --- Sessions ---------------------------------------------------------------

/**
 * Create a session row for `userId` and write the session cookie onto `res`.
 * @returns {Promise<string>} the new session id.
 */
export async function createSession(res, userId) {
  const sid = randomUUID()
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)

  await query(
    `INSERT INTO sessions (sid, user_id, expires_at) VALUES ($1, $2, $3)`,
    [sid, userId, expiresAt]
  )

  res.cookie(SESSION_COOKIE, sid, {
    ...COOKIE_OPTS,
    maxAge: SESSION_TTL_SECONDS * 1000, // express expects ms
  })

  return sid
}

/**
 * Look up a non-expired session by id and return the associated user
 * (id, email, name) or null. Joins sessions -> users so a single round trip
 * gives us everything requireAuth needs.
 */
export async function lookupSession(sid) {
  if (!sid) return null

  const { rows } = await query(
    `SELECT u.id, u.email, u.name
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.sid = $1
        AND s.expires_at > now()`,
    [sid]
  )

  return rows[0] || null
}

/** Delete a session row by id. Safe to call with an unknown/expired sid. */
export async function destroySession(sid) {
  if (!sid) return
  await query(`DELETE FROM sessions WHERE sid = $1`, [sid])
}

/** Clear the session cookie on the response (used by logout). */
export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, COOKIE_OPTS)
}

// --- Middleware -------------------------------------------------------------

/**
 * Express middleware that requires a valid session. On success it attaches
 * `req.user = { id, email, name }` and calls next(). Otherwise it responds
 * 401 { error: 'unauthorized' }. Any thrown error bubbles to the global
 * error handler (-> 500 JSON), so handlers never crash the process.
 */
export async function requireAuth(req, res, next) {
  try {
    const sid = req.cookies?.[SESSION_COOKIE]
    const user = await lookupSession(sid)
    if (!user) {
      return res.status(401).json({ error: 'unauthorized' })
    }
    req.user = user
    next()
  } catch (err) {
    next(err)
  }
}
