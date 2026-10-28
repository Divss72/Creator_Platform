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

