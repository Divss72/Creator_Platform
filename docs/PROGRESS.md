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
