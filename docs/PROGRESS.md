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


