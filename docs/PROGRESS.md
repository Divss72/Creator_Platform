# CreatorHub Progress

## Version Progress

### v0.1: Skeleton + Auth (Completed)
- [x] Implementation plan approved
- [x] Project setup & environment configuration (`.env.example`, `env.js`, `package.json`)
- [x] Error handling & utilities (`ApiError`, `errorHandler`, `notFound`, `asyncHandler`, `jwt.js`, `password.js`)
- [x] In-memory store repository layer (`userStore`, `contentStore`)
- [x] Auth & Role middleware (`requireAuth`, `requireRole`, `validate`)
- [x] Auth endpoints (`POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`)
- [x] Creator profile endpoints (`GET /api/creators/:id`, `PUT /api/creators/me`)
- [x] Content CRUD endpoints (`POST /api/content`, `GET /api/content`, `GET /api/content/:id`, `PUT /api/content/:id`, `DELETE /api/content/:id`) with ownership checks and `TODO(v0.3)` tier check comments
- [x] `requests.http` test suite
- [x] Live endpoint verification (24/24 automated integration tests passed)
- [x] `README.md` and `docs/PR-v0.1.md`

#### Notes & Decisions (v0.1):
- Implemented in-memory repository store pattern behind asynchronous methods (`findByEmail`, `findById`, `create`, `update`, `delete`, `findAll`), decoupling Express controllers completely from data storage primitives. In v0.2, these stores will be swapped directly for Sequelize ORM models without changing any controller logic.
- Implemented Zod schema validation on all write operations and standardized error reporting via `{ error: { code, message } }`.
- Enforced password hashing with bcryptjs (cost 10) and ensured password hashes are stripped across all responses.
- Prepared ownership validation on content update and delete endpoints (HTTP 403 when non-owner creator attempts modification).
- Marked subscription tier enforcement locations with explicit `TODO(v0.3)` comments.
