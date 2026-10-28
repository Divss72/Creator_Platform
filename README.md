# CreatorHub API (v0.1)

> **Creator Economy Platform** — A subscription platform where creators publish tiered content (Free / Pro / VIP) and fans subscribe and chat live on each post.

Version 0.1 provides the foundational Express skeleton, in-memory repository layer, JWT authentication, role-based access control, creator profiles, and full content CRUD with ownership enforcement.

---

## Prerequisites
- **Node.js**: v20.0.0 or higher
- **npm**: v10.0.0 or higher

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
| `PORT` | Port the HTTP server binds to | `5000` |
| `NODE_ENV` | Runtime environment (`development`, `production`, `test`) | `development` |
| `JWT_SECRET` | Secret key for signing and verifying JSON Web Tokens (min 16 chars) | `super-secret-jwt-key-change-in-production-min32chars` |
| `JWT_EXPIRES_IN` | Token expiration period | `1d` |

### 3. Start Server
- **Development** (with auto-restart via nodemon):
  ```bash
  npm run dev
  ```
- **Production**:
  ```bash
  npm start
  ```

---

## API Endpoints

### System
- `GET /health` — Health check endpoint. Returns `{ status: "ok" }`.

### Authentication
- `POST /api/auth/register` — Register a new account.
  - Body: `{ name, email, password, role }` (`role` must be `'creator'` or `'subscriber'`).
  - Returns: `201 { token, user }`.
  - Duplicate email returns `409 Conflict`.
- `POST /api/auth/login` — Log in with credentials.
  - Body: `{ email, password }`.
  - Returns: `200 { token, user }`.
  - Invalid credentials return `401 Unauthorized`.
- `GET /api/auth/me` — Retrieve current authenticated user (`Bearer <token>`).
  - Returns: `200 { user }`.

### Creator Profiles
- `GET /api/creators/:id` — Public creator profile.
  - Returns: `200 { creator: { id, name, displayName, bio, createdAt } }`.
- `PUT /api/creators/me` — Update creator profile (Creator only).
  - Headers: `Authorization: Bearer <token>`.
  - Body: `{ displayName?, bio? }`.
  - Returns: `200 { creator }`.

### Content Management
- `POST /api/content` — Publish a content post (Creator only).
  - Headers: `Authorization: Bearer <token>`.
  - Body: `{ title, body, minTier? }` (`minTier` can be `'free'`, `'pro'`, `'vip'`; default is `'free'`).
  - Returns: `201 { content }`.
- `GET /api/content` — List paginated content.
  - Query: `?page=1&limit=10`.
  - Returns: `200 { items: [...], pagination: { total, page, limit, totalPages } }`.
- `GET /api/content/:id` — Get single content item by ID.
  - Returns: `200 { content }`.
- `PUT /api/content/:id` — Update content item (Owner creator only).
  - Headers: `Authorization: Bearer <token>`.
  - Body: `{ title?, body?, minTier? }`.
  - Returns: `200 { content }`. Non-owner returns `403 Forbidden`.
- `DELETE /api/content/:id` — Delete content item (Owner creator only).
  - Headers: `Authorization: Bearer <token>`.
  - Returns: `200 { message: "Content deleted successfully" }`. Non-owner returns `403 Forbidden`.

---

## Error Handling Standard
All errors return a consistent JSON response:
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable explanation"
  }
}
```

Standard codes:
- `400` — `VALIDATION_ERROR` or `BAD_REQUEST`
- `401` — `UNAUTHORIZED`
- `403` — `FORBIDDEN`
- `404` — `NOT_FOUND`
- `409` — `CONFLICT`
- `500` — `INTERNAL_ERROR`

---

## Testing the API
Open `requests.http` in VS Code or any REST Client extension, or run API calls directly from terminal or Postman.
All tests cover successful operations, input validation errors, and permission/ownership constraints.

---

## Architectural Notes (v0.1 -> v0.2 Transition)
Data access is isolated strictly in `src/store/` behind asynchronous repository interfaces (`userStore`, `contentStore`). Controllers do not touch arrays or storage internals. In v0.2, this layer will be replaced with Sequelize models and migrations without rewriting controllers.
