# CreatorHub (v1.0)

> **Full-Stack Creator Economy Platform** — A subscription platform where creators publish tiered content (Free / Pro / VIP), fans subscribe and chat live on each post, and creators track growth with real-time analytics.

CreatorHub v1.0 is the **final, demo-ready release**, featuring a unified Express backend, deterministic 45-day demo history, real-time Socket.io live chat, Hacker News-style gravity trending, creator analytics rollups, and an interactive **2D Infinite Discover Canvas** built in React 18 + Vite.

---

## Key Features

- **Tiered Content & Strict Paywall**:
  - Three distinct tiers: **Free** ($0), **Pro** ($5/mo), and **VIP** ($15/mo).
  - Server-enforced paywall matrix: locked posts conceal both rich text bodies and media attachments at the database query level.
  - Subscriptions managed atomically with idempotency and event auditing (`subscription_events`).

- **Interactive 2D Discover Canvas (Frontend UI)**:
  - **Infinite 2D Pan Canvas**: Drag anywhere in 2D space with mouse, touch, or arrow keys with physical velocity inertia and friction decay.
  - **3D Perspective & Lens Tilt**: Cards tilt dynamically in 3D perspective relative to the center of the viewport.
  - **Full-Screen Post Overlay**: Click any card (movement < 6px) to open the post detail view, live chat, and a "You may also like" recommendation rail.
  - **Floating Glass Nav Pill**: One-click tier filtering (_All / Free / Pro / VIP_), re-center canvas (`Home`), or switch to an accessible **List View**.

- **Real-Time Live Chat & Engagement**:
  - Live discussion on every post powered by **Socket.io** (`content:<id>` rooms).
  - Privacy-preserving post view tracking via HMAC-SHA256 daily rotating salt keys (`content_view_dedupe`).
  - Like reactions with self-like prevention and single-query aggregated status (`content_reactions`).

- **Creator Analytics & Insights**:
  - Creator dashboard with **Recharts** visualizations across 7-day, 30-day, and 90-day timeframes.
  - Metrics include Monthly Recurring Revenue (MRR), total views, likes, and active subscriber breakdowns.
  - High-performance pre-aggregated daily rollups (`creator_daily_stats`, `content_daily_stats`).

- **Hacker News-Style Gravity Trending**:
  - Dynamic score recomputation: `Score = (V + 3*L + 5*C) / (T + 2)^1.5`.
  - Anti-gaming protections: only distinct non-owner commenters contribute to score.
  - High-speed REST (`GET /api/trending`) and GraphQL (`query trending`) endpoints.

- **Transactional Outbox & Email Notifications**:
  - Reliable asynchronous delivery via transactional outbox (`outbox_emails`).
  - RFC 8058 one-click unsubscribe links with HMAC-SHA256 signatures.
  - Weekly digests with ISO-week deduplication and user preference controls.

- **Realtime Firebase Mirroring**:
  - Live subscriber counts mirrored to Firebase Realtime Database with write debouncing, automatic retries, and hourly reconciliation.

---

## Tech Stack

| Layer                 | Technologies                                                                            |
| :-------------------- | :-------------------------------------------------------------------------------------- |
| **Backend**           | Node.js (>=20.18.0), Express 4, MySQL 8, Sequelize 6, Apollo Server 5 (GraphQL)         |
| **Realtime**          | Socket.io 4, Firebase Admin SDK (Realtime Database driver)                              |
| **Frontend**          | React 18, Vite 5, React Router 6, Recharts 2, DOMPurify, Lucide React, Plain CSS Tokens |
| **Security & Auth**   | JWT, bcryptjs, Helmet (strict CSP), Express Rate Limit, DOMPurify                       |
| **Media & Mail**      | Cloudinary SDK (with fake driver fallback), Nodemailer (with log driver fallback)       |
| **Testing & Tooling** | Jest 30, Supertest 7, ESLint 10 (Flat Config), Prettier 3, Docker & Docker Compose      |

---

## Architecture Rules

The platform follows strict architectural boundaries enforced by custom ESLint rules and unit tests:

1. **Migrations Only**: Schema changes happen strictly via Sequelize migrations (`sequelize-cli db:migrate`). Never `sequelize.sync()`.
2. **Store Layer Separation**: Controllers, GraphQL resolvers, socket handlers, listeners, and background jobs never import Sequelize or models directly; all database access flows through `src/store/`.
3. **Domain Service Isolation**: Access rules reside solely in `accessService`, comment constraints in `commentService`, view key hashing in `viewKey.js`, trending score calculations in `trendingScore.js`, and item serialization in `contentPresenter`.
4. **Rich Text Safety**: Sanitized HTML is permitted **only** for post bodies via `DOMPurify` (client) and `sanitize-html` (server). All other user-submitted strings are escaped plain text.
5. **Non-Blocking Side Effects**: Email dispatch, Firebase sync, and analytics rollups run asynchronously and never block, fail, or roll back a primary client request.

---

## Quickstart

### 1. Prerequisites

- **Node.js**: `v20.18.0` or higher
- **npm**: `v10.0.0` or higher
- **MySQL 8**: Local service or Docker Compose

### 2. Database Setup via Docker

Start a clean MySQL 8 container mapped to port `3307`:

```bash
docker compose up -d
```

_(To stop the database: `docker compose down`)_

### 3. Environment Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Key environment settings for local development:

```ini
PORT=5000
NODE_ENV=development
DB_HOST=127.0.0.1
DB_PORT=3307
DB_NAME=creatorhub_dev
DB_USER=creatorhub_user
DB_PASSWORD=creatorhub_pass
JWT_SECRET=super-secret-jwt-key-change-in-production-min32chars
STORAGE_DRIVER=fake
MAIL_DRIVER=log
FIREBASE_DRIVER=fake
ALLOW_DEMO_SEED=true
DEMO_RESET_CONFIRM=creatorhub_dev
```

### 4. Initialize Database & Seed 45-Day Demo Data

Run the safe demo reset script to create tables, execute migrations, and seed deterministic historical data:

```bash
npm run demo:reset
```

### 5. Build Web Client & Start Platform

Build the React frontend and start the Express server (served on port `5000`):

```bash
# Build Vite production bundle
npm --prefix web run build

# Start the unified backend & static server
npm start
```

Open your browser to:
👉 **`http://localhost:5000`**

_(In development, you can also run Vite hot-reloading dev server on `http://localhost:5173` with `npm --prefix web run dev`)_

---

## Demo Personas (1-Click Logins)

The application includes pre-configured demo accounts loaded with 45 days of engagement data:

| Role        | Name             | Email                                   | Password       | Details                                           |
| :---------- | :--------------- | :-------------------------------------- | :------------- | :------------------------------------------------ |
| **Creator** | Alice Vance      | `alice@demo.creatorhub.test`            | `Password123!` | VIP Creator with full 45-day analytics history    |
| **Creator** | Bob Tech         | `bob@demo.creatorhub.test`              | `Password123!` | Pro Creator with tech tutorials                   |
| **Creator** | Charlie Creative | `charlie@demo.creatorhub.test`          | `Password123!` | Free/Pro Creator with design stories              |
| **Fan**     | VIP Subscriber   | `sub_alice_vip_1@demo.creatorhub.test`  | `Password123!` | Subscribed to Alice as VIP (unlocks VIP posts)    |
| **Fan**     | Free Fan         | `sub_alice_free_1@demo.creatorhub.test` | `Password123!` | Subscribed as Free (sees paywall lock on Pro/VIP) |

> **Tip**: You can switch between personas instantly using the **Persona Switcher** dropdown in the navigation bar or on the `/login` page.

---

## API & GraphQL Reference

### REST Endpoints

| Category          | Method   | Endpoint                                          | Description                                  |
| :---------------- | :------- | :------------------------------------------------ | :------------------------------------------- |
| **Auth**          | `POST`   | `/api/auth/register`                              | Register new user (creator or subscriber)    |
|                   | `POST`   | `/api/auth/login`                                 | Log in and obtain JWT token                  |
|                   | `GET`    | `/api/auth/me`                                    | Fetch authenticated user profile             |
| **Content**       | `GET`    | `/api/feed`                                       | Cursor-paginated posts feed                  |
|                   | `POST`   | `/api/content`                                    | Create new post (creators only)              |
|                   | `GET`    | `/api/content/:id`                                | Get post detail (gated by paywall)           |
|                   | `POST`   | `/api/content/:id/view`                           | Log unique daily post view (privacy-safe)    |
|                   | `POST`   | `/api/content/:id/like`                           | Like post (accessible subscribers only)      |
|                   | `DELETE` | `/api/content/:id/like`                           | Unlike post                                  |
|                   | `GET`    | `/api/content/:id/comments`                       | List post comments                           |
|                   | `POST`   | `/api/content/:id/comments`                       | Post comment (accessible subscribers only)   |
| **Trending**      | `GET`    | `/api/trending`                                   | Get top posts ranked by gravity score        |
| **Subscriptions** | `POST`   | `/api/subscriptions`                              | Subscribe to creator tier (Free / Pro / VIP) |
|                   | `DELETE` | `/api/subscriptions/:creatorId`                   | Cancel active subscription                   |
|                   | `GET`    | `/api/subscriptions/mine`                         | List user's active subscriptions             |
| **Analytics**     | `GET`    | `/api/creators/me/analytics/overview`             | Active subs, MRR, views, likes summary       |
|                   | `GET`    | `/api/creators/me/analytics/timeseries?range=30d` | Daily views and subscribers time series      |
|                   | `GET`    | `/api/creators/me/analytics/top-content?limit=5`  | Top performing posts                         |
| **System**        | `GET`    | `/health`                                         | Server and database health check             |
|                   | `GET`    | `/version`                                        | Build version and commit metadata            |

### GraphQL Schema

The GraphQL API is available at `POST /graphql` with Apollo Server:

- `query feed(cursor: String, limit: Int)`: Cursor-paginated post stream.
- `query content(id: ID!)`: Single post view.
- `query trending(limit: Int, accessibleOnly: Boolean)`: Top trending posts.
- `query me`: Current user profile and active subscriptions.
- `mutation subscribe(creatorId: ID!, tier: SubscriptionTier!)`: Subscribe to creator.
- `mutation cancelSubscription(creatorId: ID!)`: Cancel subscription.
- `mutation addComment(contentId: ID!, body: String!)`: Add comment.

---

## Testing & Quality Assurance

CreatorHub maintains 100% green test suites and strict code formatting:

```bash
# 1. Run ESLint, Prettier check, and unit tests
npm run check

# 2. Run unit tests only (108 tests)
npm run test:unit

# 3. Run integration tests against test DB (37 tests across 9 suites)
npm run test:integration

# 4. Run full test suite with coverage report
npm run test:coverage

# 5. Run end-to-end verification script
npm run verify:all
```

---

## Project Structure

```text
├── src/
│   ├── app.js               # Express app factory with Helmet CSP & static serving
│   ├── bootstrap.js         # Server bootstrap, DB auth, jobs, Apollo attachment
│   ├── server.js            # Process entrypoint & graceful shutdown
│   ├── config/              # Environment, CORS, and DB config
│   ├── controllers/         # REST route handlers (no Sequelize imports)
│   ├── database/            # Sequelize migrations and seeders
│   ├── graphql/             # Apollo schema, resolvers, and DataLoaders
│   ├── jobs/                # Background cron workers (Rollup, Trending, Digest, Outbox)
│   ├── middleware/          # JWT auth, rate limiters, error handler, not-found
│   ├── models/              # Sequelize model declarations
│   ├── presenters/          # Serialization & privacy formatting (contentPresenter)
│   ├── realtime/            # Socket.io chat handlers & rooms
│   ├── routes/              # Express API route modules
│   ├── services/            # Pure business logic & domain services
│   │   ├── math/            # Pure maths (trendingScore, viewKey, rollupMath, series)
│   │   ├── mail/            # Transactional outbox mailer & templates
│   │   ├── firebase/        # Realtime Database metrics driver
│   │   └── storage/         # Cloudinary / fake media drivers
│   └── store/               # Abstracted data access layer
├── web/                     # React 18 + Vite frontend SPA
│   ├── src/
│   │   ├── components/      # Navbar, GlassPill, PostView, RichText
│   │   ├── context/         # AuthContext & 1-click persona switcher
│   │   ├── pages/           # Discover (2D Canvas), Home (Feed), PostPage, Dashboard, Studio
│   │   ├── services/        # Fetch & GraphQL client wrapper
│   │   └── styles/          # Dark theme CSS tokens & animations
│   ├── index.html           # HTML5 entrypoint
│   └── vite.config.js       # Vite build & proxy config
├── scripts/                 # CLI tools (demo-reset, trending-recompute, analytics-rebuild)
├── tests/                   # Jest unit and integration test suites
└── docker-compose.yml       # MySQL 8 development container configuration
```

---

## License

This project is licensed under the [MIT License](LICENSE).
