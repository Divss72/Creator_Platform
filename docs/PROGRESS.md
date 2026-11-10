# CreatorHub Progress

## Version Progress

### v0.1: Skeleton + Auth (Completed)

- [x] Implementation plan approved
- [x] Project setup & environment configuration
- [x] Error handling & utilities
- [x] In-memory store repository layer
- [x] Auth & Role middleware
- [x] Auth endpoints (`register`, `login`, `me`)
- [x] Creator profile endpoints (`GET /:id`, `PUT /me`)
- [x] Content CRUD endpoints (`POST`, `GET`, `GET /:id`, `PUT /:id`, `DELETE /:id`)
- [x] `requests.http` test suite
- [x] Live endpoint verification (24/24 integration tests passed)
- [x] `README.md` and `docs/PR-v0.1.md`

### v0.2: MySQL + Sequelize (Completed)

- [x] Implementation plan approved
- [x] Installed `sequelize`, `mysql2`, `sequelize-cli` with `.sequelizerc` and `docker-compose.yml`
- [x] Database configuration in `src/config/database.js` and validated env variables
- [x] Migrations for all 6 tables (`users`, `creator_profiles`, `tiers`, `content`, `subscriptions`, `comments`)
- [x] Tested clean migration rollback via `npm run db:migrate:undo`
- [x] Sequelize models with bidirectional association mappings in `src/models/`
- [x] Idempotent seeders for platform tiers and demo users/content/subscriptions/comments
- [x] Replaced in-memory store in `src/store/userStore.js` and `src/store/contentStore.js` with Sequelize
- [x] Transactional creator registration (`users` + `creator_profiles` in single managed transaction)
- [x] Eager-loading creator and tier on content list queries (eliminated N+1)
- [x] Central error handling for `SequelizeUniqueConstraintError` (409) and `SequelizeValidationError` (400) without leaking SQL
- [x] Health check update: `GET /health` returning `{ status: "ok", db: "up" | "down" }`
- [x] Associations verification script (`scripts/verify-associations.js`) testing all 11 relations
- [x] Data persistence verified across full server restart
- [x] Clear diagnostic error message on server boot if DB connection fails
- [x] `docs/DB-SCHEMA.md` with Mermaid ER diagram and design notes
- [x] Updated `README.md`, `requests.http`, and `docs/PR-v0.2.md`

#### Notes & Decisions (v0.2):

- Kept UUID primary keys (`CHAR(36)`) consistent with v0.1, preserving existing API contracts and route parameter validations.
- Controllers remain 100% decoupled from Sequelize ORM models; all database logic is encapsulated within `src/store/`.
- Full schema created for `subscriptions` and `comments` in advance of v0.3 and v0.4 features.
- Running `npm run db:reset` drops, recreates, migrates, and seeds the entire database idempotently.

### v0.3: Subscriptions + Paywall (Completed)

- [x] Implementation plan approved
- [x] Tier repository and store caching in `src/store/tierStore.js`
- [x] Public `GET /api/tiers` endpoint returning dynamic ranks and pricing
- [x] Framework-independent access control service in `src/services/accessService.js` (no Express objects)
- [x] Mock payment processor in `src/services/mockPaymentService.js` with `TODO(future)`
- [x] Subscription repository in `src/store/subscriptionStore.js` with idempotent subscribe, cancel, and bulk lookup
- [x] `optionalAuth` middleware (attaches user on valid token, null on missing token, 401 on malformed/expired)
- [x] `requireTier` middleware for fixed tier route restrictions
- [x] Subscription management endpoints (`POST /api/subscriptions`, `GET /api/subscriptions/me`, `DELETE /api/subscriptions/:creatorId`)
- [x] Paywall preview enforcement on `GET /api/content` and `GET /api/content/:id` (`locked`, `body: null`, `excerpt`, `viewerTier`)
- [x] Zero body leakage on locked content via explicit allow-list field construction
- [x] Constant query count on content lists via `findActiveByViewerAndCreators` (single query for all creators on feed)
- [x] Idempotent paywall matrix seeds (`seed-demo-data.js`) covering Free, Pro, VIP posts and Active/Cancelled/Expired subscriptions
- [x] Automated test suite `scripts/verify-paywall.js` passing 56/56 checks
- [x] Regression testing: v0.1 and v0.2 suites passing 24/24 checks
- [x] Documentation updated: `README.md`, `requests.http`, `docs/PROGRESS.md`, `docs/PR-v0.3.md`

#### Notes & Decisions (v0.3):

- **Access Rule Decoupling**: All tier resolution and paywall evaluation logic is fully isolated in `src/services/accessService.js` with pure functions, ready for reuse in v0.4 (Socket.io) and v0.5 (GraphQL).
- **Single-Query Bulk Lookups**: Content feed loads viewer active subscriptions across all post creators using a single `WHERE subscriber_id = :viewerId AND creator_id IN (:creatorIds)` query mapped into a `Map<creatorId, Subscription>`, completely preventing N+1 queries.
- **Paywall Response Contract**: A locked item detail request returns `200 OK` (not `403` or `402`), enabling clients to display rich teaser previews and upgrade prompts.
- **Strict UUID Hex Format**: Seeded IDs conform strictly to RFC 4122 hexadecimal UUID format (`[0-9a-f]`) to pass Zod validation across all endpoints.

### v0.4: Realtime Socket.io & Live Chat (Completed)

- [x] Implementation plan approved
- [x] Installed `socket.io` and dev-dependency `socket.io-client`
- [x] Added `CORS_ORIGIN` env variable with production wildcard restriction (`*` allowed in development only)
- [x] Created `src/store/commentStore.js` with cursor-based pagination and strict allow-list serialization (never exposing emails or password hashes)
- [x] Created `src/services/commentService.js` without Express/Socket.io dependencies, reusing `accessService.resolveAccess`
- [x] Implemented `GET /api/content/:id/comments` chat history endpoint with cursor pagination and paywall gating
- [x] Attached Socket.io server to Express HTTP server on the same port (`PORT=5000`)
- [x] Handshake auth middleware (`src/realtime/auth.js`) supporting anonymous connections and validating JWT tokens against DB
- [x] Private user rooms (`user:{id}`) joined at handshake for cross-tab messaging
- [x] Mid-session token expiration detection on `comment:create`
- [x] Distinct viewer presence tracking (`src/realtime/presence.js`) counting unique viewers across multiple tabs
- [x] Sliding-window anti-spam rate limiter (`src/realtime/rateLimiter.js`) enforcing max 5 comments per 10s per socket
- [x] Thin socket event handlers (`post:join`, `post:leave`, `comment:create`) with uniform ack shape
- [x] Safe non-blocking events facade (`src/realtime/events.js`) catching errors so REST endpoints never fail
- [x] Wired facade notifications into `src/controllers/subscriptions.controller.js` and `src/controllers/content.controller.js`
- [x] Live access revocation: subscription cancellation, downgrade, and post tier updates revoke open room sockets in real time
- [x] Post deletion broadcasts `post:deleted` and evicts all sockets from the room
- [x] Interactive dev test page (`public/dev-chat.html`) served at `/dev/chat` in development mode
- [x] Automated end-to-end test suite `scripts/verify-realtime.js` passing 65/65 checks
- [x] Regression testing: `scripts/verify-paywall.js` still passes 56/56 checks
- [x] Clean graceful shutdown closing Socket.io connections, then HTTP server, then DB pool
- [x] Full documentation: `docs/REALTIME.md`, `README.md`, `requests.http`, `docs/PR-v0.4.md`

#### Notes & Decisions (v0.4):

- **Distinct Presence Counting**: Presence tracks `Map<contentId, Map<viewerKey, Set<socketId>>>` in memory. An authenticated user opening multiple browser tabs counts as a single viewer and only decrements when their final tab leaves.
- **Single Write Path**: Comment writes occur strictly over Socket.io (`comment:create`). REST only exposes read access via `GET /api/content/:id/comments`.
- **Zero Leakage**: Sockets and REST endpoints serialize comments using a strict allow-list: `{ id, contentId, body, createdAt, user: { id, name, role } }`.
- **Safe Facade**: REST controllers never import Socket.io directly; all realtime notifications pass through `src/realtime/events.js` and cannot crash HTTP requests.

### v0.5: GraphQL Read-Only API (Completed)

- [x] Implementation plan approved
- [x] Installed `@apollo/server` v5, `@as-integrations/express4`, `graphql`, and `dataloader`
- [x] Extracted shared serialization presenter `src/presenters/contentPresenter.js` (`formatContentItem`, `generateExcerpt`)
- [x] Refactored `src/controllers/content.controller.js` to use shared presenter (verified 100% byte-for-byte REST compatibility)
- [x] Extended `src/services/accessService.js` with `getViewerAccessProfile` and `resolveAccessFromProfile`
- [x] Added `findActiveBySubscriber` in `src/store/subscriptionStore.js`
- [x] Added `findCreatorsByIds` and `findCreatorById` in `src/store/userStore.js` (omitting email/passwordHash)
- [x] Added `countByContentIds` in `src/store/commentStore.js` for batching
- [x] Implemented keyset pagination (`WHERE (created_at, id) < cursor`), SQL-level access filters, and cursor codecs in `src/store/contentStore.js`
- [x] Authoritative schema definition `src/graphql/schema.graphql` with queries (`tiers`, `feed`, `content`, `creator`, `contentComments`) and custom `DateTime` scalar
- [x] Custom `DateTime` ISO-8601 scalar implementation in `src/graphql/scalars.js`
- [x] Per-request DataLoaders in `src/graphql/loaders.js` (`creatorLoader`, `commentCountLoader`)
- [x] Per-request authentication context in `src/graphql/context.js` (HTTP 401 on bad/expired tokens, allow-listed user fields)
- [x] Central error mapping in `src/graphql/errors.js` mapping `ApiError` to standard codes (`UNAUTHENTICATED`, `INVALID_TOKEN`, `TOKEN_EXPIRED`, `NOT_FOUND`, `TIER_REQUIRED`, `VALIDATION_ERROR`, `INTERNAL_ERROR`)
- [x] AST validation rule in `src/graphql/validation/depthLimit.js` enforcing maximum query depth <= 6
- [x] AsyncLocalStorage SQL query counter plugin in `src/graphql/plugins/queryCountPlugin.js` exposing `extensions.queryCount` in development
- [x] Thin resolvers in `src/graphql/resolvers/` (`index.js`, `query.js`, `contentItem.js`, `creator.js`, `comment.js`)
- [x] Attached Apollo Server to Express via dedicated router in `src/graphql/index.js` with HTTP drain plugin, dev Sandbox, and production hardening
- [x] Mounted `graphqlRouter` in `src/app.js` before 404 handler and hooked into `src/server.js` graceful shutdown
- [x] Expanded demo seed data in `20261028000002-seed-demo-data.js` to 16 posts with tied timestamps for ID tiebreaker verification
- [x] Documented GraphQL queries, mutations policy, fragment examples, and frontend guide in `docs/GRAPHQL.md`
- [x] Appended Section 10 to `requests.http` with GraphQL feed queries, pagination, paywall previews, filters, and auth tests
- [x] Built comprehensive 69-check automated test suite `scripts/verify-graphql.js` (paywall, zero body leak, aliases/fragments, keyset pagination, filters, DataLoader batching, depth limits, production hardening)
- [x] Verified full regression pass: `verify-paywall.js` (56/56 checks) and `verify-realtime.js` (65/65 checks) passing
- [x] Updated `README.md`, `docs/PROGRESS.md`, and prepared `docs/PR-v0.5.md`

#### Notes & Decisions (v0.5):

- **Shared Content Presenter**: Extracted `src/presenters/contentPresenter.js` so REST and GraphQL share identical serialization and preview generation logic. REST and GraphQL can never drift apart on paywall shapes.
- **SQL-Level Access Filtering**: The `accessibleOnly` feed filter is resolved at the database query level via `accessProfile` (`owner OR free OR active_creator_subscription`), ensuring pages are never short and keyset cursors stay stable.
- **Keyset Cursor Pagination**: Implemented `(created_at, id) < cursor` keyset pagination ordered newest first (`created_at DESC, id DESC`). No `OFFSET` is used; pages fetch `first + 1` rows to determine `hasNextPage` and return opaque base64 cursors.
- **Constant SQL Query Count**: Feed query executes 1 query for content rows, 1 batched query for creator profiles (via `creatorLoader`), 1 batched query for comment counts (via `commentCountLoader`), and 1 optional count query if `totalCount` is selected. Query count is O(1) regardless of `first` page size.
- **Production Hardening**: In production (`NODE_ENV=production`), Apollo introspection is rejected, `extensions.queryCount` is omitted, stack traces are masked, and Apollo Sandbox landing page is disabled.

### v0.6: Media + Security Hardening (Completed)

- [x] Implementation plan approved
- [x] Installed `cloudinary`, `multer`, `sanitize-html`, `express-rate-limit`, `helmet`, and `file-type@16.5.4` (CommonJS)
- [x] Database migrations: `20261104000001-create-media` (`media` table) and `20261104000002-add-avatar-public-id-to-creator-profiles` (`avatar_public_id` column)
- [x] Tested clean rollback and re-apply of both migrations
- [x] Defined `Media` model in `src/models/Media.js` with bidirectional associations to `Content` and `User`
- [x] Storage driver abstraction in `src/services/storage/` (`index.js`, `cloudinaryDriver.js`, `fakeDriver.js`)
- [x] Business logic in `src/services/mediaService.js`: MIME sniffing, magic byte verification, SVG rejection, atomic limits, row-locking quota checks, signing, cascade deletion
- [x] Dual-class text safety policy in `src/services/sanitizeService.js`: `sanitizeRichText` (safe HTML tags with `rel="noopener noreferrer nofollow"`), `cleanPlainText` (Unicode NFC, bidi removal, control char removal, HTML tag rejection), `generatePlainTextExcerpt`
- [x] Updated presenters in `src/presenters/contentPresenter.js` to format `media` allow-list and `mediaCount` with zero leakage on locked posts
- [x] Integrated `cleanPlainText` across validators (`content.validator.js`, `auth.validator.js`, `creators.validator.js`) and `commentService.js`
- [x] Data sanitisation backfill script in `scripts/sanitize-backfill.js` (dry-run and `--apply`)
- [x] Multi-tier rate limiting in `src/middleware/rateLimiters.js` and `src/config/limits.js` (global, auth register, auth login with skip successful, user writes, media upload, GraphQL)
- [x] GraphQL cost limiter in `src/graphql/validation/rootFieldsLimit.js` capping root fields and aliases <= 10
- [x] Socket handshake rate limiter capping concurrent connections <= 20 per IP
- [x] Unified CORS configuration in `src/config/cors.js` shared by REST, GraphQL, and Socket.io
- [x] Strict production startup safety checks in `src/config/env.js`
- [x] Express request body size limit set to 100 KB; helmet configured with dev-relaxed CSP and strict production CSP
- [x] Extended GraphQL schema and resolvers with `MediaKind`, `Media` type, `ContentItem.media`, `ContentItem.mediaCount`, and `Creator.avatarUrl`
- [x] Created `docs/MEDIA.md`, `docs/SECURITY.md`, `docs/PR-v0.6.md`, updated `docs/DB-SCHEMA.md`, `README.md`, `requests.http`
- [x] Built comprehensive verification suites: `scripts/verify-media.js` (50/50 checks) and `scripts/verify-security.js` (47/47 checks)
- [x] Built unified test runner `scripts/verify-all.js` (all 6 platform test suites passed cleanly: 298/298 checks)

#### Notes & Decisions (v0.6):

- **Authenticated Cloudinary Delivery**: Post media is never stored publicly; uploaded under `type: 'authenticated'` with ephemeral signed URLs generated on the fly.
- **Paywall Parity on Media**: When a post is locked, `media` is `[]`, `mediaCount` is visible, and Cloudinary `public_id` is never revealed to any client.
- **Atomic Concurrency Protection**: Multi-attachment limits ($\le 5$) and creator storage quotas ($\le 200$ MB) are guarded with database transactions and `SELECT ... FOR UPDATE` row locks to prevent race condition over-allocation.
- **Dual-Class Text Safety**: Distinguishes rich-text (post bodies, sanitized via `sanitize-html`) from plain-text (titles, names, comments, bios, which strictly reject tag-like syntax while permitting mathematical symbols like `<3` and `<`).

### v0.7: Email + Firebase Subscriptions Mirror (Completed)

- [x] Implementation plan approved
- [x] Installed `nodemailer`, `node-cron`, and `firebase-admin`
- [x] Database migrations: `20261109000001-add-notification-preferences-to-users` (`notify_new_posts`, `notify_weekly_digest`) and `20261109000002-create-email-outbox` (`email_outbox` table)
- [x] Tested clean rollback and re-apply of both migrations
- [x] Defined `EmailOutbox` model in `src/models/EmailOutbox.js` and updated `User` model
- [x] Created `src/utils/subscriptionStatus.js` single source of truth for active subscription calculation
- [x] Mail driver abstraction in `src/services/mail/` (`index.js`, `logDriver.js`, `smtpDriver.js`, templates for `welcome`, `newPost`, `digest`)
- [x] Firebase driver abstraction in `src/services/firebase/` (`index.js`, `fakeDriver.js`, `firebaseDriver.js`)
- [x] In-process domain events bus (`src/events/domainEvents.js`, `src/events/listeners.js`) with non-blocking try/catch listeners
- [x] Emitted `subscription.changed` and `content.created` domain events from controllers after DB transaction commits
- [x] Transactional outbox store in `src/store/outboxStore.js` with `SELECT ... FOR UPDATE SKIP LOCKED` and stuck row recovery
- [x] Notification service in `src/services/notificationService.js` handling email enqueuing, recipient abuse caps, and HMAC-SHA256 tokens
- [x] Send-time access revocation check in outbox worker, guaranteeing zero data leakage if subscription status changes prior to delivery
- [x] Weekly digest generator in `src/services/digestService.js` with ISO-week deduplication (`digest:${userId}:${isoWeek}`)
- [x] Firebase synchronization service in `src/services/firebaseSyncService.js` with event debouncing (`FIREBASE_SYNC_DEBOUNCE_MS`), exponential retries, and hourly reconciliation
- [x] Background cron and worker infrastructure in `src/jobs/` (`emailWorker.js`, `purgeJob.js`, `digestJob.js`, `firebaseReconcileJob.js`, `index.js`)
- [x] Notification preferences endpoints (`GET/PUT /api/notifications/preferences`) and public RFC 8058 one-click unsubscribe (`GET/POST /api/email/unsubscribe?token=...`) with `unsubscribeLimiter`
- [x] Creator dashboard endpoints (`GET /api/creators/me/firebase-token`, `GET /api/creators/me/dashboard/subscribers`)
- [x] Firebase declarative security rules in `firebase/database.rules.json` (read restricted to matching `auth.uid`, client writes disabled)
- [x] Dev endpoints in `src/app.js`: `/dev/mail`, `/dev/firebase`
- [x] Mailpit service added to `docker-compose.yml` for local SMTP inspection
- [x] CLI tools: `scripts/digest-run.js`, `scripts/email-status.js`, `scripts/firebase-resync.js`
- [x] Verification suites: `scripts/verify-email.js` (33/33 checks passed) and `scripts/verify-firebase.js` (29/29 checks passed)
- [x] Full regression run via `scripts/verify-all.js` (all 8 platform suites passed cleanly: 360/360 checks)
- [x] Full documentation: `docs/NOTIFICATIONS.md`, `docs/FIREBASE.md`, `docs/PR-v0.7.md`, updated `docs/DB-SCHEMA.md`, `docs/SECURITY.md`, `README.md`, `requests.http`

#### Notes & Decisions (v0.7):

- **Side-Effect Isolation**: Email enqueuing and Firebase synchronization run strictly as asynchronous side effects. Failures in SMTP or Firebase never roll back database transactions or fail client REST/GraphQL/Socket requests.
- **Transactional Outbox & Send-Time Checks**: Emails are persisted into the `email_outbox` table. Before sending, the worker re-evaluates the recipient's tier access; if the subscription was cancelled in the interim, the email is skipped with reason `access_revoked`, preventing body/excerpt leakage.
- **Zero Raw Body Leakage**: New post notifications use sanitized plain-text excerpts derived via `sanitizeService`, never raw HTML or secret post bodies.
- **Write Debouncing & Coalescing**: Rapid bursts of subscription changes are coalesced within a configurable debounce buffer (`FIREBASE_SYNC_DEBOUNCE_MS`, default 1000ms), writing to Firebase Realtime Database at most once per debounce window per creator.
- **Stateless HMAC Unsubscribe**: One-click unsubscribe links and headers use HMAC-SHA256 signatures with 30-day expiration, eliminating the need for separate unsubscribe database tables.

### v0.8: Tests + CI/CD (Completed)

- [x] Implementation plan approved
- [x] Pinned Node LTS (`22.14.0`) via `.nvmrc` and strict `package.json` engines
- [x] ESLint flat configuration (`eslint.config.js`) enforcing architectural boundaries (no Sequelize/model imports outside `store/`)
- [x] Prettier configuration and whole-codebase formatting
- [x] Refactored `src/app.js` into side-effect-free `createApp(overrides)`
- [x] Created `src/bootstrap.js` managing deterministic graceful startup/shutdown order
- [x] Deterministic zero-sleep hooks: `whenIdle()`, `firebaseSyncService.flush()`, `emailWorker.runOnce()`, `waitFor()`
- [x] Multi-project Jest configuration (`jest.config.js`) with unit and integration projects
- [x] Test database safety mechanism enforcing `NODE_ENV=test` and `_test` database name suffix
- [x] Test helpers: `api.js`, `db.js`, `factories.js`, `queryCounter.js`, `clock.js`, `waitFor.js`
- [x] Comprehensive unit test suites (82/82 tests passed):
  - `accessService.test.js`
  - `subscriptionStatus.test.js`
  - `sanitizeService.test.js`
  - `contentPresenter.test.js`
  - `validateEnv.test.js`
- [x] Integration test suites:
  - `subscriptionFlow.integration.test.js` (full lifecycle, concurrency handling, immediate paywall access reflection)
  - `paywallMatrix.integration.test.js` (personas x tiers matrix and O(1) query complexity verification)
  - `auth.integration.test.js` (registration, login, authentication, and role authorization)
  - `health.integration.test.js` (health liveness, degraded DB 503 status, version token gate)
- [x] Production readiness: `scripts/smoke-test.js`, `scripts/migrate-and-start.js`, `scripts/seed-demo.js`
- [x] Multi-stage `Dockerfile` and `.dockerignore` running as non-root `node` user with healthcheck
- [x] GitHub Actions workflows: `.github/workflows/ci.yml`, `.github/workflows/cd.yml`
- [x] Dependabot configuration (`.github/dependabot.yml`) and PR template (`.github/pull_request_template.md`)
- [x] Documentation: `docs/TESTING.md`, `docs/CI-CD.md`, `docs/DEPLOYMENT.md`, `docs/PR-v0.8.md`
