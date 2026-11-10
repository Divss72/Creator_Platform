# CreatorHub API (v0.7)

> **Creator Economy Platform** — A subscription platform where creators publish tiered content (Free / Pro / VIP) and fans subscribe and chat live on each post.

Version 0.7 introduces **Email Notifications (Transactional Outbox) & Firebase Live Subscriber Metrics**:

- **Transactional Outbox Email Subsystem**: Welcome emails on subscription, new-post fan-out with send-time access checks, automated weekly digest with ISO-week deduplication, user notification preferences, and RFC 8058 one-click unsubscribe links with HMAC-SHA256 signatures.
- **Firebase Live Subscriber Metrics**: Realtime subscriber counts (total and per-tier breakdown) mirrored from MySQL to Firebase Realtime Database with write debouncing, automatic retries, and hourly reconciliation. Creator dashboard token minting and REST fallback endpoints.
- **Side-Effect Isolation**: Email and Firebase operations run strictly as side effects; failures never block, fail, or roll back REST, GraphQL, or Socket.io operations. MySQL remains the single source of truth.

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

_(To stop the container: `docker compose down`)_

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

| Variable                    | Description                                                        | Default                                                   |
| :-------------------------- | :----------------------------------------------------------------- | :-------------------------------------------------------- |
| `PORT`                      | HTTP server port                                                   | `5000`                                                    |
| `NODE_ENV`                  | Environment (`development`, `production`, `test`)                  | `development`                                             |
| `JWT_SECRET`                | Secret key for signing JWT tokens (min 16 chars)                   | `super-secret-jwt-key-change-in-production-min32chars`    |
| `JWT_EXPIRES_IN`            | Token expiration period                                            | `1d`                                                      |
| `DB_HOST`                   | MySQL database host                                                | `127.0.0.1`                                               |
| `DB_PORT`                   | MySQL database port                                                | `3307`                                                    |
| `DB_NAME`                   | MySQL database name                                                | `creatorhub_dev`                                          |
| `DB_USER`                   | MySQL username                                                     | `creatorhub_user`                                         |
| `DB_PASSWORD`               | MySQL user password                                                | `creatorhub_pass`                                         |
| `DB_LOGGING`                | Enable SQL query logging in console (`true` or `false`)            | `false`                                                   |
| `CORS_ORIGIN`               | Unified CORS allowed origins (`*` in dev, comma-separated in prod) | `*`                                                       |
| `TRUST_PROXY`               | Number of trusted reverse proxy hops (e.g. `1`) or `false`         | `0`                                                       |
| `RATE_LIMIT_ENABLED`        | Enable rate limiting (`true` or `false`)                           | `true`                                                    |
| `STORAGE_DRIVER`            | File storage driver (`fake` for dev/test, `cloudinary` in prod)    | `fake`                                                    |
| `CLOUDINARY_CLOUD_NAME`     | Cloudinary cloud name (required if `STORAGE_DRIVER=cloudinary`)    | _(none)_                                                  |
| `CLOUDINARY_API_KEY`        | Cloudinary API key (required if `STORAGE_DRIVER=cloudinary`)       | _(none)_                                                  |
| `CLOUDINARY_API_SECRET`     | Cloudinary API secret (required if `STORAGE_DRIVER=cloudinary`)    | _(none)_                                                  |
| `MAIL_DRIVER`               | Email transport driver (`log` for dev/test, `smtp` in prod)        | `log`                                                     |
| `SMTP_HOST`                 | SMTP server hostname (required if `MAIL_DRIVER=smtp`)              | `127.0.0.1`                                               |
| `SMTP_PORT`                 | SMTP server port                                                   | `1025`                                                    |
| `SMTP_USER`                 | SMTP server username                                               | _(empty)_                                                 |
| `SMTP_PASS`                 | SMTP server password                                               | _(empty)_                                                 |
| `SMTP_FROM`                 | Default outgoing sender email address                              | `CreatorHub <notifications@creatorhub.local>`             |
| `EMAIL_TOKEN_SECRET`        | Secret key for signing HMAC unsubscribe tokens (min 32 chars)      | `super-secret-email-token-key-change-in-production-min32` |
| `FIREBASE_DRIVER`           | Firebase driver (`fake` for dev/test, `firebase` in prod)          | `fake`                                                    |
| `FIREBASE_PROJECT_ID`       | Firebase project identifier                                        | _(optional in fake)_                                      |
| `FIREBASE_CLIENT_EMAIL`     | Firebase service account client email                              | _(optional in fake)_                                      |
| `FIREBASE_PRIVATE_KEY`      | Firebase service account private key (PEM string)                  | _(optional in fake)_                                      |
| `FIREBASE_DATABASE_URL`     | Firebase Realtime Database URL                                     | `https://creatorhub-default-rtdb.firebaseio.com`          |
| `FIREBASE_SYNC_DEBOUNCE_MS` | Debounce window in ms for Firebase writes                          | `1000`                                                    |

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

| Command                       | Description                                                                  |
| :---------------------------- | :--------------------------------------------------------------------------- |
| `npm run db:create`           | Creates the MySQL database if it does not already exist                      |
| `npm run db:drop`             | Drops the database if it exists                                              |
| `npm run db:migrate`          | Runs all pending database migrations in sequence                             |
| `npm run db:migrate:undo`     | Rolls back all applied migrations cleanly                                    |
| `npm run db:seed`             | Runs idempotent seeders for tiers and demo paywall dataset                   |
| `npm run db:reset`            | Drops DB, recreates DB, migrates schema, and seeds demo data                 |
| `npm run verify:paywall`      | Runs comprehensive 56-check paywall and access verification suite            |
| `npm run verify:associations` | Runs bidirectional relation verification script across all models            |
| `npm run verify:realtime`     | Runs automated 65-check Socket.io realtime and chat verification suite       |
| `npm run verify:graphql`      | Runs comprehensive 69-check GraphQL verification suite                       |
| `npm run verify:media`        | Runs 50-check media uploads and paywall parity verification suite            |
| `npm run verify:security`     | Runs 47-check security hardening and rate limit verification suite           |
| `npm run verify:email`        | Runs 33-check email outbox, new-post fan-out, and HMAC unsubscribe suite     |
| `npm run verify:firebase`     | Runs 29-check Firebase Realtime synchronization, debouncing, and token suite |
| `npm run verify:all`          | Runs all 8 platform verification suites in sequence (360 checks)             |
| `npm run digest:run`          | Runs weekly digest generator CLI (supports `--dry-run` and `--now=ISO`)      |
| `npm run email:status`        | Inspects transactional email outbox status and queue counts                  |
| `npm run firebase:resync`     | Triggers full MySQL-to-Firebase subscriber count reconciliation              |
| `npm run sanitize:backfill`   | Runs data sanitisation backfill (dry-run or `--apply`)                       |

---

## Seeded Demo Accounts (Development & Demo Only)

All demo account passwords are: `Password123!`

| Role           | Name                     | Email                              | Subscription / Paywall Matrix State                     |
| :------------- | :----------------------- | :--------------------------------- | :------------------------------------------------------ |
| **Creator**    | Alice Creator            | `alice.creator@creatorhub.local`   | Has Free, Pro, and VIP posts (Creator 1)                |
| **Creator**    | Charlie Creator          | `charlie.creator@creatorhub.local` | Has Free, Pro, and VIP posts (Creator 2)                |
| **Subscriber** | Subscriber A (VIP)       | `suba.vip@creatorhub.local`        | Active **VIP** subscription to Alice                    |
| **Subscriber** | Subscriber B (Pro)       | `subb.pro@creatorhub.local`        | Active **Pro** subscription to Alice                    |
| **Subscriber** | Subscriber C (Free)      | `subc.free@creatorhub.local`       | No active subscriptions (Free viewer)                   |
| **Subscriber** | Subscriber D (Cancelled) | `subd.cancelled@creatorhub.local`  | **Cancelled** subscription to Charlie                   |
| **Subscriber** | Subscriber E (Expired)   | `sube.expired@creatorhub.local`    | **Expired** subscription to Charlie (`ends_at` in past) |

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

_All subscription endpoints require `subscriber` role authentication (`Authorization: Bearer <token>`)._

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

### Chat History & Comments (v0.4)

- `GET /api/content/:id/comments` — Retrieve paginated comments for a post (`?limit=50&before=<commentId>`).
  - Uses `optionalAuth`.
  - Same paywall rules apply: if content is locked for the viewer, returns `403 Forbidden` (`TIER_REQUIRED` with `details: { requiredTier, viewerTier }`).
  - Returns: `{ items: [...oldest to newest within page], nextBefore: string | null }`.
  - Comment writes happen **strictly over Socket.io** (single write path).

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

### Notification Preferences (v0.7)

_Requires user authentication (`Authorization: Bearer <token>`)._

- `GET /api/notifications/preferences` — Get notification preferences (`{ notifyNewPosts: boolean, notifyWeeklyDigest: boolean }`).
- `PUT /api/notifications/preferences` — Update preferences. Body: `{ notifyNewPosts?: boolean, notifyWeeklyDigest?: boolean }`.

### One-Click Unsubscribe (v0.7)

_Public endpoints protected by HMAC-SHA256 signature verification and `unsubscribeLimiter` (10 req/15 min)._

- `GET /api/email/unsubscribe?token=<hmac_token>` — Web confirmation page for email unsubscribe link.
- `POST /api/email/unsubscribe?token=<hmac_token>` — RFC 8058 one-click unsubscribe action (List-Unsubscribe-Post).

### Creator Dashboard & Firebase Metrics (v0.7)

_Creator endpoints require `creator` role authentication._

- `GET /api/creators/me/firebase-token` — Mint short-lived Firebase custom auth token with claims `{ role: 'creator' }` for Realtime Database client subscriptions.
- `GET /api/creators/me/dashboard/subscribers` — REST dashboard fallback returning active subscriber counts (`{ subscriberCount, byTier: { free, pro, vip } }`).

---

## Socket.io Realtime Service (v0.4)

Socket.io attaches directly to the HTTP server on port `5000`. Authenticate during handshake via `io(url, { auth: { token } })` or connect anonymously by omitting `token`.

### Realtime Events Matrix

| Event            | Direction            | Auth Required | Payload                                    | Description                                                                                                                         |
| :--------------- | :------------------- | :------------ | :----------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------- |
| `post:join`      | Client &rarr; Server | Optional      | `{ contentId }`                            | Joins room `post:{contentId}` if viewer has paywall access. Ack: `{ contentId, viewerCount, canComment }`. Max 10 rooms per socket. |
| `post:leave`     | Client &rarr; Server | Optional      | `{ contentId }`                            | Leaves room and updates distinct presence. Ack: `{ contentId }`.                                                                    |
| `comment:create` | Client &rarr; Server | Required      | `{ contentId, body }`                      | Validates body (1-1000 chars, plain text), re-verifies live access, persists to DB, broadcasts `comment:new`. Ack: `{ comment }`.   |
| `comment:new`    | Server &rarr; Client | -             | `{ id, contentId, body, createdAt, user }` | Broadcast to entire room including sender. Plain-text only.                                                                         |
| `viewers:update` | Server &rarr; Client | -             | `{ contentId, count }`                     | Broadcast to room when distinct viewer count changes.                                                                               |
| `access:revoked` | Server &rarr; Client | -             | `{ contentId, reason }`                    | Sent to socket when subscription cancellation or post update revokes room access.                                                   |
| `post:deleted`   | Server &rarr; Client | -             | `{ contentId }`                            | Broadcast to room when post is deleted over REST; room is subsequently emptied.                                                     |

For detailed packet structures, error codes, and frontend sequence diagrams, see [docs/REALTIME.md](docs/REALTIME.md).

---

## Try the Live Chat (/dev/chat)

When running in development (`NODE_ENV=development`), CreatorHub serves a standalone test page at:

```
http://localhost:5000/dev/chat
```

### How to Test Live Chat Interactively:

1. **Connect**:
   - To connect **anonymously**: Leave the token field blank and click **Connect**.
   - To connect as a **subscriber or creator**: Paste a JWT token (e.g. from `/api/auth/login`) and click **Connect**.
2. **Explore a Post Room**:
   - Enter a content ID (e.g. Alice's Free Post `c1111111-1111-4111-8111-111111111111` or VIP Post `c3333333-3333-4333-8333-333333333333`).
   - Click **Get History** to load past comments via `GET /api/content/:id/comments`.
   - Click **Join Room** to subscribe to live updates. Notice the distinct viewer count increments.
3. **Send Live Comments**:
   - If authenticated with valid access, type a message and click **Send**. The comment appears instantly across all tabs in that room.
4. **Test Real-Time Revocation**:
   - Open a second browser tab, log in as Subscriber C, upgrade to Pro, and join Alice's Pro post room.
   - Cancel the subscription via REST: notice the socket immediately receives `access:revoked` and comment capabilities are disabled.

---

## GraphQL API (v0.5)

Apollo Server is attached to the same Express HTTP server at `POST /graphql`. It provides a read-only schema for feed browsing, single posts, creator profiles, tiers, and comment history.

### Key GraphQL Features:

- **Keyset Cursor Pagination**: Relay-style `(created_at, id) < cursor` pagination with opaque cursors (`first`, `after`, `pageInfo.hasNextPage`, `pageInfo.endCursor`).
- **Paywall & Preview Enforcement**: Locked posts set `locked: true`, `body: null`, provide `excerpt`, and report `viewerTier`. The full body **never leaks** (tested across aliases and fragment spreads).
- **Feed Filtering**: Filter by `creatorId`, `minTiers` (`[FREE, PRO, VIP]`), `accessibleOnly` (posts viewer can read in full), and `subscribedOnly` (posts from subscribed creators, requires auth).
- **N+1 Batching**: Per-request DataLoaders for `creator` profiles and `commentCount`.
- **Query Performance & Counting**: In development mode, responses include `extensions.queryCount` measuring total SQL queries executed.
- **Security & Limits**: Max query depth capped at 6, max `first` capped at 50, max comment `limit` capped at 100. In production (`NODE_ENV=production`), introspection is disabled, debug extensions are omitted, and Apollo Sandbox is not served.

For full query examples, fragment patterns, error shapes, and frontend guidance, see [docs/GRAPHQL.md](docs/GRAPHQL.md).

---

## Try GraphQL (Apollo Sandbox)

When running in development (`NODE_ENV=development`), open your browser to:

```
http://localhost:5000/graphql
```

This loads the embedded Apollo Sandbox IDE directly against your local server.

### Example 1: Paginated Feed with Viewer Paywall Status

```graphql
query GetFeed($first: Int, $after: String) {
  feed(first: $first, after: $after) {
    totalCount
    pageInfo {
      hasNextPage
      endCursor
    }
    edges {
      cursor
      node {
        id
        title
        minTier
        locked
        viewerTier
        body
        excerpt
        commentCount
        creator {
          id
          displayName
        }
      }
    }
  }
}
```

### Example 2: Filtered Feed (Accessible Posts Only)

```graphql
query GetAccessibleFeed {
  feed(filter: { accessibleOnly: true }, first: 10) {
    edges {
      node {
        id
        title
        minTier
        locked
        body
      }
    }
  }
}
```

To run authenticated queries in Apollo Sandbox, add an HTTP Header at the bottom:

```json
{
  "Authorization": "Bearer <YOUR_JWT_TOKEN>"
}
```

---

## Architecture & Database Design

For architectural specifications and security details, see:

- [docs/DB-SCHEMA.md](docs/DB-SCHEMA.md) — Entity-Relationship diagrams, table schemas, indexes.
- [docs/NOTIFICATIONS.md](docs/NOTIFICATIONS.md) — Transactional email outbox pattern, digest engine, HMAC unsubscribe tokens.
- [docs/FIREBASE.md](docs/FIREBASE.md) — Firebase Realtime Database live subscriber metrics, write debouncing, security rules.
- [docs/MEDIA.md](docs/MEDIA.md) — Media storage drivers, upload flow, signed URLs, paywall parity.
- [docs/SECURITY.md](docs/SECURITY.md) — Security hardening, dual-class text policy, rate limits, CORS.
- [docs/GRAPHQL.md](docs/GRAPHQL.md) — GraphQL schema, queries, cursor pagination.
- [docs/REALTIME.md](docs/REALTIME.md) — Socket.io live chat and room lifecycle.
