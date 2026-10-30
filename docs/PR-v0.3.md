# Pull Request: v0.3 Subscriptions + Paywall

## Summary of Changes
This PR completes **Version 0.3 (v0.3)** of the CreatorHub platform. It implements dynamic tier ranking, framework-independent access resolution, mock subscription purchases with idempotent upgrades/cancellations, and safe server-side paywall preview enforcement for content.

### Key Changes:
1. **Tier Management (`src/store/tierStore.js`, `src/controllers/tiers.controller.js`, `src/routes/tiers.routes.js`)**:
   - Built tier repository with in-memory caching for tier models and name-to-tier mappings.
   - Exposed public `GET /api/tiers` returning `[{ name, rank, priceCents }]` dynamically from the database.

2. **Framework-Independent Access Service (`src/services/accessService.js`)**:
   - Zero Express coupling — pure functions designed for re-use in v0.4 (Socket.io rooms) and v0.5 (GraphQL resolvers).
   - `canAccess(viewerRank, requiredRank)`: Pure numerical rank comparison.
   - `resolveViewerTier({ viewerId, creatorId })`: Resolves effective tier considering content ownership (owner -> full access), active subscriptions (`status === 'active'` and unexpired), or default free.
   - `resolveAccess({ viewer, content })`: Single-item access evaluator returning `{ hasAccess, viewerTier, requiredTier }`.
   - `resolveAccessBulk({ viewer, contents })`: Bulk evaluator executing **a single database query** (`findActiveByViewerAndCreators`) for all unique creators on a feed page, completely eliminating N+1 queries.

3. **Mock Payment Service (`src/services/mockPaymentService.js`)**:
   - Tiny abstraction simulating payment processing with `TODO(future)` comments, ensuring zero real payment code while decoupling controllers.

4. **Subscription Store & Controller (`src/store/subscriptionStore.js`, `src/controllers/subscriptions.controller.js`, `src/routes/subscriptions.routes.js`)**:
   - `POST /api/subscriptions`: Mock purchase with transaction and graceful recovery on race conditions.
     - `201 Created`: Brand-new subscription.
     - `200 OK`: Upgrading/downgrading tier or reactivating a cancelled subscription.
     - `200 OK (idempotent)`: Re-subscribing at identical active tier without duplicate rows.
     - `403 Forbidden`: Creator attempting to subscribe.
     - `404 Not Found`: Unknown or non-creator user ID.
     - `400 Bad Request`: Invalid tier name or schema validation failure.
   - `GET /api/subscriptions/me`: Lists subscriber's subscriptions with creator ID, display name, tier, and status.
   - `DELETE /api/subscriptions/:creatorId`: Cancels subscription (sets `status: 'cancelled'` immediately revoking access; returns 404 if subscription not found).

5. **Auth Middleware Updates (`src/middleware/optionalAuth.js`, `src/middleware/requireTier.js`)**:
   - `optionalAuth`: Gracefully sets `req.user = null` if no token is present; attaches decoded user if valid; returns `401 Unauthorized` on malformed or expired tokens (never silently falls back to anonymous).
   - `requireTier(tierName)`: Route middleware for endpoints with fixed tier requirements.

6. **Paywall Content Gating (`src/controllers/content.controller.js`, `src/routes/content.routes.js`)**:
   - Mounted `optionalAuth` on `GET /api/content` and `GET /api/content/:id`.
   - Replaced all `TODO(v0.3)` placeholders with real access gating.
   - Formatted item response shape:
     - `locked: true | false`
     - `body: "<full text>" | null` (always `null` when `locked: true`)
     - `excerpt: "<first ~200 chars>"` (server-generated teaser preview)
     - `viewerTier: "free" | "pro" | "vip"` (effective tier of viewer with this creator)
   - Zero body leakage: returned JSON object is constructed strictly from an allow-list of fields.
   - Locked detail requests return `200 OK` (preview), **not** `403` or `402`.

7. **Paywall Matrix Seed Data (`src/database/seeders/20261028000002-seed-demo-data.js`)**:
   - Seeded 2 creators (Alice and Charlie) with Free, Pro, and VIP posts.
   - Seeded 5 subscriber accounts covering active VIP, active Pro, unsubscribed free, cancelled, and expired subscriptions.
   - Content bodies structured with public teasers in excerpt range (~200 chars) and private technical secrets beyond 250 characters.

8. **Comprehensive Automated Verification (`scripts/verify-paywall.js`)**:
   - 56-check paywall test suite using Node's built-in `fetch` against the live running server.
   - Covers anonymous, free, pro, vip, cross-creator isolation, owner access, cancelled/expired access, upgrade/downgrade/cancel workflows, duplicate row prevention, creator 403 guard, body leak inspection, and constant-query validation.

---

## Migration Steps for Reviewers

1. **Ensure Database is Running**:
   ```bash
   docker compose up -d
   ```
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Reset and Seed Database with Paywall Matrix**:
   ```bash
   npm run db:reset
   ```
4. **Start Application**:
   ```bash
   npm run dev
   ```

---

## How to Test

### 1. Run Automated Paywall Verification (56 checks)
In a separate terminal while the server is running:
```bash
npm run verify:paywall
```
*Expected output: All 56 checks pass with exit code 0.*

### 2. Run Regression Test Suite
Verify that v0.1 auth/creator/content behaviors and v0.2 persistence remain 100% intact:
```bash
node scripts/verify-associations.js
```
*Expected: "ALL 11 ASSOCIATIONS VERIFIED SUCCESSFULLY!"*

### 3. Manual Testing via REST Client
Open [requests.http](requests.http) to execute requests for:
- `GET /api/tiers`
- `POST /api/subscriptions` (subscribe, upgrade, idempotency, creator 403)
- `GET /api/subscriptions/me`
- `DELETE /api/subscriptions/:creatorId`
- Content feeds as anonymous vs Pro vs VIP vs Owner.
