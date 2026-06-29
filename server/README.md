# Roomio Server

Standalone authentication, session, and designs backend for the Roomio
room-designer. Plain Express + PostgreSQL, no ORM, ES modules.

## Stack

- **Express 4** — HTTP + routing
- **pg** — PostgreSQL client (connection pool)
- **bcryptjs** — password hashing (10 rounds)
- **cookie-parser** — reads the session cookie

## Running

```bash
cd server
npm install
npm start            # listens on PORT (default 5181)
```

In dev the front-end runs on Vite (`:5180`) and proxies `/api/*` to this
server, so it is effectively same-origin and no CORS is required.

### Environment variables

| Var            | Default                        | Purpose                          |
| -------------- | ------------------------------ | -------------------------------- |
| `PORT`         | `5181`                         | Port the server listens on       |
| `DATABASE_URL` | `postgresql://localhost/roomio`| PostgreSQL connection string     |

The database schema is created automatically on boot via `initDb()` (all
`CREATE TABLE IF NOT EXISTS`, so it is safe to run repeatedly).

## Database schema

- **users** — `id` (UUID text PK), `email` (unique, lowercased), `password_hash`,
  `name`, `created_at`
- **sessions** — `sid` (UUID text PK), `user_id` (FK → users, cascade),
  `created_at`, `expires_at`
- **designs** — `id` (client RoomDesign id, PK), `user_id` (FK → users, cascade),
  `name`, `shape`, `data` (JSONB, full RoomDesign), `created_at`, `updated_at`

## Sessions

On signup/login the server inserts a `sessions` row with
`expires_at = now() + 30 days` and sets an httpOnly cookie:

```
roomio_sid=<sid>; Path=/; SameSite=Lax; Max-Age=2592000
```

The cookie is **not** `secure` so it works over plain http in local dev.
`requireAuth` reads the cookie, looks up a non-expired session, and attaches
`req.user = { id, email, name }`; otherwise it responds `401 { error: 'unauthorized' }`.
Logout deletes the session row and clears the cookie.

## API

All requests/responses are JSON. Errors return a helpful `{ error }` with an
appropriate status code. Any thrown error becomes a JSON `500` (the process
never crashes). Dates are returned as **epoch milliseconds**.

### Auth

| Method | Path               | Auth | Body                      | Success                        |
| ------ | ------------------ | ---- | ------------------------- | ------------------------------ |
| POST   | `/api/auth/signup` | no   | `{ email, password, name? }` | `200 { user: {id,email,name} }` |
| POST   | `/api/auth/login`  | no   | `{ email, password }`     | `200 { user }`                 |
| POST   | `/api/auth/logout` | no   | —                         | `200 { ok: true }`             |
| GET    | `/api/auth/me`     | yes  | —                         | `200 { user }`                 |

- **signup** validates email format and `password.length >= 6`; returns `400`
  on invalid input, `409` if the email is already registered.
- **login** returns `401 { error: 'invalid credentials' }` on bad email or
  password (same message either way, so registered emails aren't leaked).

### Designs (all require auth)

| Method | Path               | Body                | Success                                                  |
| ------ | ------------------ | ------------------- | -------------------------------------------------------- |
| GET    | `/api/designs`     | —                   | `200 [{ id, name, shape, updatedAt, createdAt }]` newest first |
| GET    | `/api/designs/:id` | —                   | `200 <full RoomDesign JSON>`, `404` if not owned/found   |
| POST   | `/api/designs`     | full `RoomDesign`   | `200 { ok: true, id }`                                   |
| DELETE | `/api/designs/:id` | —                   | `200 { ok: true }`                                       |

- **POST** upserts by `RoomDesign.id`. If a row with that id exists under a
  **different** user it returns `403 { error: 'forbidden' }`; otherwise it
  inserts (or updates the owner's row) and sets `updated_at = now()`.
- **DELETE** is idempotent and only affects rows owned by the caller.

### Misc

| Method | Path          | Auth | Success            |
| ------ | ------------- | ---- | ------------------ |
| GET    | `/api/health` | no   | `200 { ok: true }` |

Unknown `/api/*` routes return `404 { error: 'not found' }`.

## File layout

- `index.js` — Express app, all routes, error handling, boot
- `auth.js` — password hashing/verification, session create/lookup/destroy,
  `requireAuth` middleware, cookie handling
- `db.js` — pg `Pool`, `query()` helper, idempotent `initDb()` schema bootstrap
