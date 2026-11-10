# Pull Request: v0.8 - Tests, Quality Gates & CI/CD

## Summary

Version 0.8 transitions CreatorHub into a provably correct and automatically shippable production-ready platform. It introduces a comprehensive automated Jest and Supertest suite, architectural boundary lint rules, multi-stage Docker containerization, and GitHub Actions CI/CD workflows.

## Key Changes

1. **Architectural Enforcement**:
   - ESLint flat configuration (`eslint.config.js`) enforces import boundaries (no controllers/handlers/resolvers/jobs importing Sequelize or models directly; only `store/`).
   - Pinned Node LTS (`22.14.0`) via `.nvmrc` and strict `package.json` engines.
   - Prettier code style formatting.
2. **Deterministic Test Infrastructure**:
   - `createApp(overrides)` factory with zero side-effects on import.
   - `bootstrap()` orchestrator managing graceful startup and shutdown order.
   - Zero arbitrary `sleep()` calls in test suites using deterministic hooks (`whenIdle()`, `flush()`, `runOnce()`, `waitFor()`).
   - Strict database safety guard refusing any run where `NODE_ENV !== 'test'` or the database name does not end in `_test`.
3. **Automated Test Suites**:
   - **Unit Tests**: `accessService`, `subscriptionStatus`, `sanitizeService`, `contentPresenter`, `validateEnv`.
   - **Integration Tests**: `subscriptionFlow` (exhaustive lifecycle, concurrency handling, and immediate paywall reflection), `paywallMatrix` (personas x tiers matrix and O(1) query complexity), `auth`, `health`.
4. **Production Readiness & CI/CD**:
   - Multi-stage `Dockerfile` running as non-root `node` user with healthcheck.
   - `.github/workflows/ci.yml` with `lint`, `unit`, `integration`, `security`, `image`, and `ci-ok` jobs.
   - `.github/workflows/cd.yml` with GHCR image publish, `DEPLOY_ENABLED` deployment gate, and health check.
   - `scripts/smoke-test.js`, `scripts/migrate-and-start.js`, `scripts/seed-demo.js`.

## Bugs Found by the New Tests

1. **HTML Parser ESM Conflict**: Newer versions of `sanitize-html` pulled pure ESM `htmlparser2@12` breaking CommonJS Jest execution. Resolved by pinning `sanitize-html@2.13.0` which uses CommonJS `htmlparser2@8`.
2. **Transaction Rollback on Concurrency**: In `subscriptionStore.subscribe`, when MySQL raised an `ER_LOCK_DEADLOCK` or `ER_DUP_ENTRY` under concurrent subscriptions, calling `await transaction.rollback()` on an already-rolled-back transaction threw an unhandled error. Fixed by checking `!transaction.finished` and implementing automatic retry and fallback.
3. **Health Degraded Status**: `/health` previously returned HTTP 200 even when database connectivity failed. Fixed to return HTTP 503 when the database is unreachable.
4. **Subscription Status Parameter Shape**: `isActiveSubscription` threw when passed options as a plain object. Fixed to support both `(sub, now)` and `(sub, { now })`.

## Manual Steps for Reviewer

1. Review automated CI workflow runs on GitHub Actions.
2. Merge `feature/v0.8-tests-cicd` into `develop`.
3. Tag release `v0.8.0` on `main`.
