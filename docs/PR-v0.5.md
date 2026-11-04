# Pull Request: v0.5 GraphQL Read-Only Content Feed & API

## Summary of Changes
This PR implements **Version 0.5 (v0.5)** of the CreatorHub platform. It adds a read-only GraphQL API at `POST /graphql` on the same Express HTTP server and port, exposing the tiered content feed with keyset cursor pagination, flexible feed filters (by creator, tier, accessibility, and active subscriptions), single posts and creator profiles, platform tiers, and post comment histories. Writes remain strictly on REST and live chat on Socket.io. No database migrations were required.

---

### Key Changes:

1. **Apollo Server 5 Integration (`src/graphql/`)**:
   - Installed `@apollo/server` (v5.5.1), `@as-integrations/express4`, `graphql`, and `dataloader`.
   - Attached Apollo Server to the shared Express app via a dedicated router (`src/graphql/index.js`) mounted before the Express 404 handler.
   - Configured `httpServer` drain plugin for graceful shutdown in `src/server.js`.
   - Enabled embedded Apollo Sandbox landing page in development mode (`http://localhost:5000/graphql`) and disabled in production.

2. **Authoritative GraphQL Schema (`src/graphql/schema.graphql`)**:
   - Single source of truth SDL defining queries: `tiers`, `feed`, `content`, `creator`, `contentComments`.
   - Defined types: `Tier`, `Creator`, `ContentItem`, `PageInfo`, `ContentEdge`, `ContentConnection`, `CommentAuthor`, `Comment`, `CommentPage`.
   - Defined enums: `TierName` (`FREE`, `PRO`, `VIP`) and `Role` (`CREATOR`, `SUBSCRIBER`).
   - Custom `DateTime` ISO-8601 string scalar (`src/graphql/scalars.js`).
   - Defined `FeedFilter` input: `creatorId`, `minTiers`, `accessibleOnly`, `subscribedOnly`.

3. **Shared Content Presenter (`src/presenters/contentPresenter.js`)**:
   - Extracted shared serialization and preview generation logic (`formatContentItem`, `generateExcerpt`).
   - Refactored `src/controllers/content.controller.js` to use the presenter.
   - Guaranteed byte-for-byte parity between REST and GraphQL endpoints.
   - Strictly enforces zero body leakage on locked posts (`body: null`, server-generated excerpt, allow-listed output shape).

4. **Access Service Expansion & SQL Translation (`src/services/accessService.js`, `src/store/contentStore.js`)**:
   - Added `getViewerAccessProfile({ viewerId })` to query active, non-expired subscriptions in a single database lookup.
   - Added `resolveAccessFromProfile` for fast in-memory access evaluation.
   - `src/store/contentStore.js` translates access profiles into SQL `WHERE` clauses for `accessibleOnly`:
     `(creator_id = viewerId) OR (min_tier rank <= defaultRank) OR (creator_id = X AND min_tier rank <= rankByCreatorId[X])`.
   - Access filtering happens at the database level before pagination, guaranteeing correct cursor progression and full pages.

5. **Keyset Cursor Pagination**:
   - Implemented Relay-style keyset pagination in `src/store/contentStore.js` using `WHERE (created_at, id) < cursor ORDER BY created_at DESC, id DESC`.
   - Avoids `OFFSET` performance bottlenecks.
   - Cursors are opaque base64-encoded JSON `{ createdAt, id }`.
   - Handles ties cleanly using post `id` as tiebreaker.
   - Fetches `first + 1` rows to calculate `hasNextPage` and `endCursor`.
   - Querying `totalCount` executes a separate count query only if selected in the client query AST.

6. **Batching & N+1 Prevention with DataLoaders (`src/graphql/loaders.js`)**:
   - Instantiated per request inside GraphQL context (never shared across requests).
   - `creatorLoader`: Batches creator profile lookups by user ID using `userStore.findCreatorsByIds`.
   - `commentCountLoader`: Batches comment counts by content ID using `commentStore.countByContentIds`.
   - Feed query executes a constant number of SQL queries regardless of `first` page size ($O(1)$ query complexity).

7. **Authentication & Error Handling (`src/graphql/context.js`, `src/graphql/errors.js`)**:
   - Context reads `Authorization: Bearer <token>` header:
     - No token &rarr; `viewer = null` (anonymous).
     - Valid token &rarr; `viewer = { id, role, name }` (allow-listed fields).
     - Malformed/expired token &rarr; rejects entire request with HTTP 401 and code `INVALID_TOKEN` or `TOKEN_EXPIRED`.
   - `formatError` maps project `ApiError` instances to standardized GraphQL error codes (`UNAUTHENTICATED`, `NOT_FOUND`, `TIER_REQUIRED`, `VALIDATION_ERROR`, `INTERNAL_ERROR`).
   - Masked internal errors and stack traces in production to prevent database schema leakage.

8. **Security & Guardrails**:
   - Custom query depth limit rule (`src/graphql/validation/depthLimit.js`) rejecting queries with AST depth > 6.
   - Input validation: `first` capped at 1..50; `limit` on comments capped at 1..100.
   - Body parsing limit of 100 KB on `/graphql`.
   - In production (`NODE_ENV=production`), introspection queries are rejected, debug extensions are omitted, and Apollo Sandbox is disabled.

9. **Development Query Monitoring (`src/graphql/plugins/queryCountPlugin.js`)**:
   - Uses `node:async_hooks` `AsyncLocalStorage` and Sequelize `beforeQuery` hook.
   - Tracks total SQL queries executed during the GraphQL request lifecycle and exposes `extensions.queryCount` in development mode.

10. **Testing & Verification**:
    - Expanded demo seeds to 16 posts with tied timestamps for pagination tiebreaker testing.
    - Built comprehensive 69-check test suite `scripts/verify-graphql.js`.
    - Maintained 100% backward compatibility: `scripts/verify-paywall.js` (56/56 checks) and `scripts/verify-realtime.js` (65/65 checks) passing.

---

## How to Test

### 1. Run Automated Verifications
```bash
# Reset database and seed demo dataset
npm run db:reset

# Run dev server in background or separate terminal
npm run dev

# Run GraphQL verification suite (69 checks)
npm run verify:graphql

# Run paywall & realtime regression suites
npm run verify:paywall
npm run verify:realtime
```
*Expected: All 69 GraphQL checks pass, all 56 paywall checks pass, and all 65 realtime checks pass.*

### 2. Interactive Apollo Sandbox
1. Start the server in development mode:
   ```bash
   npm run dev
   ```
2. Open your browser to `http://localhost:5000/graphql`.
3. Try querying the content feed:
   ```graphql
   query GetFeed {
     feed(first: 10) {
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
4. Authenticate by adding an `Authorization` header at the bottom:
   ```json
   {
     "Authorization": "Bearer <TOKEN>"
   }
   ```
   *(Obtain tokens by calling `POST /api/auth/login` for demo accounts like `alice.creator@creatorhub.local` or `suba.vip@creatorhub.local` with password `Password123!`)*

### 3. Keyset Cursor Walk
Query the next page using the `endCursor` from page 1:
```graphql
query NextPage($after: String!) {
  feed(first: 5, after: $after) {
    pageInfo {
      hasNextPage
      endCursor
    }
    edges {
      node {
        id
        title
      }
    }
  }
}
```
