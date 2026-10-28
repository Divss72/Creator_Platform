# CreatorHub API (v0.2)

> **Creator Economy Platform** — A subscription platform where creators publish tiered content (Free / Pro / VIP) and fans subscribe and chat live on each post.

Version 0.2 introduces persistent relational storage backed by **MySQL 8** and **Sequelize ORM**, replacing the in-memory data store without breaking any v0.1 API behaviors.

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

---

## Database Scripts

| Command | Description |
| :--- | :--- |
| `npm run db:create` | Creates the MySQL database if it does not already exist |
| `npm run db:drop` | Drops the database if it exists |
| `npm run db:migrate` | Runs all pending database migrations in sequence |
| `npm run db:migrate:undo` | Rolls back all applied migrations cleanly |
| `npm run db:seed` | Runs idempotent seeders for tiers and demo dataset |
| `npm run db:reset` | Drops DB, recreates DB, migrates schema, and seeds demo data |
| `node scripts/verify-associations.js` | Runs bidirectional relation verification script across all models |

---

## Seeded Demo Accounts (Development & Demo Only)
All demo account passwords are: `Password123!`

| Role | Name | Email | Bio / Notes |
| :--- | :--- | :--- | :--- |
| **Creator** | Alice Creator | `alice.creator@creatorhub.local` | Distributed systems, event streams, microservices |
| **Creator** | Charlie Creator | `charlie.creator@creatorhub.local` | Kubernetes, Cloud Native, DevOps engineering |
| **Subscriber** | Bob Subscriber | `bob.subscriber@creatorhub.local` | Subscribed to Alice (Pro tier) |
| **Subscriber** | Dave Subscriber | `dave.subscriber@creatorhub.local` | Subscribed to Alice (VIP tier) |
| **Subscriber** | Eve Subscriber | `eve.subscriber@creatorhub.local` | Subscribed to Charlie (Free tier) |

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

### Content Management
- `POST /api/content` — Publish post (Creator only). Body: `{ title, body, minTier }`.
- `GET /api/content` — List paginated content (`?page=1&limit=10`).
- `GET /api/content/:id` — Retrieve single post by ID.
- `PUT /api/content/:id` — Update post (Owner creator only).
- `DELETE /api/content/:id` — Delete post (Owner creator only).

---

## Architecture & Database Design
For detailed Entity-Relationship diagrams, table descriptions, indexes, and design decisions, refer to [docs/DB-SCHEMA.md](docs/DB-SCHEMA.md).
