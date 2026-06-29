// db.js
// -----------------------------------------------------------------------------
// PostgreSQL connection pool + idempotent schema bootstrap for the Roomio
// backend. The pool is shared across the whole process; `initDb()` is called
// once on boot from index.js and creates every table with CREATE TABLE IF NOT
// EXISTS so it is safe to run on every startup.
// -----------------------------------------------------------------------------

import pg from 'pg'

const { Pool } = pg

// Connection string. Defaults to the local trust/peer-auth `roomio` database;
// override with DATABASE_URL in any other environment.
const connectionString =
  process.env.DATABASE_URL || 'postgresql://localhost/roomio'

// A single shared pool for the lifetime of the process. pg manages a small set
// of physical connections under the hood and hands them out per query.
export const pool = new Pool({ connectionString })

/**
 * Thin query helper so callers don't have to reach into the pool directly.
 * @param {string} text  Parameterized SQL ($1, $2, ...).
 * @param {Array} [params] Bound parameter values.
 * @returns {Promise<import('pg').QueryResult>}
 */
export function query(text, params) {
  return pool.query(text, params)
}

/**
 * Create the schema if it does not yet exist. Idempotent: safe to call on every
 * boot. All three tables key off TEXT ids (we generate UUIDs in JS via
 * crypto.randomUUID()) so we don't depend on any Postgres extensions.
 */
export async function initDb() {
  // users — one row per account. email is stored lowercased and is unique.
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name          TEXT,
      created_at    TIMESTAMPTZ DEFAULT now()
    )
  `)

  // sessions — one row per active login. Cascade-deletes with the owning user.
  await query(`
    CREATE TABLE IF NOT EXISTS sessions (
      sid        TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL
    )
  `)

  // designs — one row per saved RoomDesign. `id` is the client-generated
  // RoomDesign.id; `data` holds the full design JSON. Cascade-deletes with user.
  await query(`
    CREATE TABLE IF NOT EXISTS designs (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name       TEXT,
      shape      TEXT,
      data       JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `)

  // Helpful secondary indexes for the common access patterns: listing a user's
  // designs newest-first, and resolving a session by user.
  await query(
    `CREATE INDEX IF NOT EXISTS designs_user_id_idx ON designs (user_id)`
  )
  await query(
    `CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id)`
  )
}
