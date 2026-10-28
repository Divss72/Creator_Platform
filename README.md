# CreatorHub API (v0.3)

> **Creator Economy Platform** — A subscription platform where creators publish tiered content (Free / Pro / VIP) and fans subscribe and chat live on each post.

Version 0.3 introduces **Access Tiers, Subscriptions & Content Paywall**, featuring framework-independent access resolution, mock subscription purchases with idempotent upgrades/cancellations, and server-side preview enforcement.

---

## Prerequisites
- **Node.js**: v20.0.0 or higher
- **npm**: v10.0.0 or higher
- **MySQL**: v8.0 or Docker / Docker Compose

---

## Database Setup

### Option A: Using Docker Compose (Recommended)
Spin up a dedicated MySQL 8 container mapped to port `3307`:
```bash
docker compose up -d
```
*(To stop the container: `docker compose down`)*

### Option B: Local MySQL 8 Service
If you run MySQL locally on your host machine:
1. Ensure the MySQL service is running on your configured port (e.g. `3306` or `3307`).
2. Update `DB_PORT`, `DB_USER`, and `DB_PASSWORD` in your `.env` file to match your local setup.

---

## Quickstart

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | HTTP server port | `5000` |
| `NODE_ENV` | Environment (`development`, `production`, `test`) | `development` |
| `JWT_SECRET` | Secret key for signing JWT tokens (min 16 chars) | `super-secret-jwt-key-change-in-production-min32chars` |
| `JWT_EXPIRES_IN` | Token expiration period | `1d` |
| `DB_HOST` | MySQL database host | `127.0.0.1` |
| `DB_PORT` | MySQL database port | `3307` |
| `DB_NAME` | MySQL database name | `creatorhub_dev` |
| `DB_USER` | MySQL username | `creatorhub_user` |
| `DB_PASSWORD` | MySQL user password | `creatorhub_pass` |
| `DB_LOGGING` | Enable SQL query logging in console (`true` or `false`) | `false` |

### 3. Initialize Database, Run Migrations & Seed
Run the all-in-one reset script (creates DB, runs migrations, seeds initial data):
```bash
npm run db:reset
```

### 4. Start the Application
- **Development** (with auto-restart via nodemon):
  ```bash
  npm run dev
  ```
- **Production**:
  ```bash
  npm start
  ```

### 5. Verify the Paywall & Access Tiers
Run the automated paywall verification suite:
```bash
npm run verify:paywall
```

---

## How Access Tiers Work

### 1. Tier Hierarchy
Platform tiers are dynamically ranked and stored in the `tiers` table (never hardcoded in controllers):
- `free` = Rank 0 ($0.00)
- `pro` = Rank 1 ($9.99 / 999 cents)
- `vip` = Rank 2 ($29.99 / 2999 cents)

### 2. Scoped Subscriptions
Subscriptions are strictly **per creator** (`UNIQUE(subscriber_id, creator_id)`). Being VIP for Creator A grants zero access privileges to Creator B's gated content.

### 3. Effective Tier Resolution
The effective tier of any viewer requesting content by a specific creator is resolved via `src/services/accessService.js`:
1. **Content Owner**: The viewer is the creator who published the content &rarr; Full access to all own content (effective tier: `vip`).
2. **Active Subscriber**: The viewer has a subscription to that creator with `status === 'active'` and (`ends_at IS NULL` OR `ends_at > NOW()`) &rarr; That subscription's tier.
3. **Everyone Else**: Anonymous visitors, unsubscribed users, cancelled (`status === 'cancelled'`), or expired (`ends_at <= NOW()`) subscriptions &rarr; Effective tier: `free`.

### 4. Access Rule & Paywall Preview
- A viewer can read the full body when `viewerRank >= contentMinTierRank`.
- **Free content** is accessible to everyone in full, including unauthenticated visitors.
- **Locked content**:
  - The API returns `200 OK` (preview), **not** `403` or `402`.
  - Full `body` is set to `null` and **never leaks** to the client anywhere in the JSON response (constructed from an allow-list of fields).
  - A server-generated `excerpt` (~200 characters) is provided so the client can render an engaging preview and upgrade prompt.
- **Bulk Feed Optimization**: `resolveAccessBulk` fetches the viewer's active subscriptions for all creators on the page in a **single query**, eliminating N+1 queries.

---

## Database Scripts

| Command | Description |
| :--- | :--- |
| `npm run db:create` | Creates the MySQL database if it does not already exist |
| `npm run db:drop` | Drops the database if it exists |
| `npm run db:migrate` | Runs all pending database migrations in sequence |
| `npm run db:migrate:undo` | Rolls back all applied migrations cleanly |
| `npm run db:seed` | Runs idempotent seeders for tiers and demo paywall dataset |
| `npm run db:reset` | Drops DB, recreates DB, migrates schema, and seeds demo data |
| `npm run verify:paywall` | Runs comprehensive 56-check paywall and access verification suite |
| `npm run verify:associations` | Runs bidirectional relation verification script across all models |

---

## Seeded Demo Accounts (Development & Demo Only)
All demo account passwords are: `Password123!`

| Role | Name | Email | Subscription / Paywall Matrix State |
| :--- | :--- | :--- | :--- |
| **Creator** | Alice Creator | `alice.creator@creatorhub.local` | Has Free, Pro, and VIP posts (Creator 1) |
| **Creator** | Charlie Creator | `charlie.creator@creatorhub.local` | Has Free, Pro, and VIP posts (Creator 2) |
| **Subscriber** | Subscriber A (VIP) | `suba.vip@creatorhub.local` | Active **VIP** subscription to Alice |
| **Subscriber** | Subscriber B (Pro) | `subb.pro@creatorhub.local` | Active **Pro** subscription to Alice |
| **Subscriber** | Subscriber C (Free) | `subc.free@creatorhub.local` | No active subscriptions (Free viewer) |
| **Subscriber** | Subscriber D (Cancelled) | `subd.cancelled@creatorhub.local` | **Cancelled** subscription to Charlie |
| **Subscriber** | Subscriber E (Expired) | `sube.expired@creatorhub.local` | **Expired** subscription to Charlie (`ends_at` in past) |

> ⚠️ **Security Warning**: Demo accounts and credentials are for local development and testing only. Never use these credentials in production environments.

---

## API Endpoints

### System
- `GET /health` — Health check endpoint. Returns `{ status: "ok", db: "up" | "down" }`.

### Authentication
- `POST /api/auth/register` — Register a new account (`creator` or `subscriber`).
  - Returns `201 { token, user }`. Duplicate email returns `409 Conflict`.
- `POST /api/auth/login` — Authenticate with email & password.
  - Returns `200 { token, user }`.
- `GET /api/auth/me` — Retrieve current authenticated user (`Bearer <token>`).

### Creator Profiles
- `GET /api/creators/:id` — Public creator profile (`id`, `name`, `displayName`, `bio`).
- `PUT /api/creators/me` — Update authenticated creator profile (Creator only).

### Tiers (v0.3)
- `GET /api/tiers` — Public. Returns all platform tiers with ranks and prices:
  ```json
  {
    "tiers": [
      { "name": "free", "rank": 0, "priceCents": 0 },
      { "name": "pro", "rank": 1, "priceCents": 999 },
      { "name": "vip", "rank": 2, "priceCents": 2999 }
    ]
  }
  ```

### Subscriptions (v0.3)
*All subscription endpoints require `subscriber` role authentication (`Authorization: Bearer <token>`).*
- `POST /api/subscriptions` — Mock purchase / tier update.
  - Body: `{ "creatorId": "<uuid>", "tier": "free" | "pro" | "vip" }`
  - Status codes:
    - `201 Created`: When a new subscription is created.
    - `200 OK`: When updating tier (upgrade/downgrade), re-activating a cancelled subscription, or identical active tier (idempotent).
    - `403 Forbidden`: When a creator attempts to subscribe.
    - `404 Not Found`: Unknown creator ID or target user is not a creator.
    - `400 Bad Request`: Invalid tier or validation error.
- `GET /api/subscriptions/me` — List all subscriptions for authenticated subscriber with creator ID, displayName, tier, and status.
- `DELETE /api/subscriptions/:creatorId` — Cancel subscription to creator (sets `status: "cancelled"`, immediate revocation).

### Content Management & Paywall (v0.3)
- `POST /api/content` — Publish post (Creator only). Body: `{ title, body, minTier }`.
- `GET /api/content` — List paginated content (`?page=1&limit=10`). Optional authentication (`optionalAuth`).
- `GET /api/content/:id` — Retrieve single post. Optional authentication (`optionalAuth`). Returns `200` with preview when locked.
- `PUT /api/content/:id` — Update post (Owner creator only).
- `DELETE /api/content/:id` — Delete post (Owner creator only).

#### Content Item Response Shape
```json
{
  "id": "77777777-7777-4777-8777-777777777771",
  "title": "Welcome to my Creator Channel",
  "minTier": "pro",
  "creator": {
    "id": "a1111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "name": "Alice Creator",
    "displayName": "Alice Creator"
  },
  "locked": true,
  "body": null,
  "excerpt": "Welcome everyone! In this post, we discuss the basics of distributed architectures...",
  "viewerTier": "free",
  "createdAt": "2026-10-28T05:00:00.000Z",
  "updatedAt": "2026-10-28T05:00:00.000Z"
}
```

---

## Architecture & Database Design
For detailed Entity-Relationship diagrams, table descriptions, indexes, and design decisions, refer to [docs/DB-SCHEMA.md](docs/DB-SCHEMA.md).

