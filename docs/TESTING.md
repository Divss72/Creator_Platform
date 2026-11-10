# Testing Strategy & Automated Test Suite (v0.8)

## Overview
CreatorHub v0.8 introduces an automated Jest and Supertest test suite that supersedes the manual `verify-*` scripts as the authoritative source of truth.

## Safety & Database Isolation
- **Test Database Protection**: The test harness strictly refuses to execute unless:
  1. `NODE_ENV === 'test'`
  2. The connected database name ends with `_test` (e.g. `creatorhub_test`).
- **Global Setup & Teardown**:
  - `tests/setup/globalSetup.js` ensures the test database exists, applies all migrations, and loads the reference tier seeds.
  - `tests/setup/globalTeardown.js` cleanly closes Sequelize connection pools.
  - `tests/helpers/db.js` (`resetDb()`) truncates application data tables while preserving reference tiers before each integration test.

## Zero-Sleep Policy & Deterministic Hooks
To prevent flaky tests and slow execution, tests NEVER rely on arbitrary `setTimeout` or sleep loops:
- **Domain Events**: `whenIdle()` in `src/events/domainEvents.js` tracks in-flight asynchronous tasks and resolves when all listener work settles.
- **Firebase Mirroring**: `firebaseSyncService.flush()` flushes all pending debounced sync operations immediately.
- **Email Worker**: `createEmailWorker().runOnce()` processes a single worker cycle synchronously.
- **Polling & Retries**: `waitFor(conditionFn, options)` polls predicate functions on a high-frequency interval with an explicit timeout.

## Test Suites & Coverage
- **Unit Tests (`tests/unit/`)**:
  - `accessService.test.js`: Matrix access evaluations, boundary conditions, precedence, and bulk resolution.
  - `subscriptionStatus.test.js`: Status definitions, expiration logic, and active criteria.
  - `sanitizeService.test.js`: Rich-text HTML sanitization, plain-text escaping, and XSS attack corpus.
  - `contentPresenter.test.js`: Paywall presentation allow-list, locked content secret body/media redaction.
  - `validateEnv.test.js`: Table-driven configuration parsing and strict production checks.
- **Integration Tests (`tests/integration/`)**:
  - `subscriptionFlow.integration.test.js`: Comprehensive subscription lifecycle (creation, upgrades, downgrades, idempotency, cancellation, reactivation, concurrency handling, and immediate paywall access reflection).
  - `paywallMatrix.integration.test.js`: Matrix of viewer roles x post tiers and O(1) query complexity verification.
  - `auth.integration.test.js`: User registration, role validation, authentication, and JWT verification.
  - `health.integration.test.js`: Health liveness and readiness gates, timing-safe version obfuscation.

## Regression Mapping
All legacy `verify-*` script assertions have direct parity in Jest:
| Legacy Script | Jest Test Suite |
|---|---|
| `verify-associations.js` | `tests/integration/paywallMatrix.integration.test.js` |
| `verify-paywall.js` | `tests/unit/accessService.test.js`, `tests/integration/paywallMatrix.integration.test.js` |
| `verify-realtime.js` | `tests/integration/subscriptionFlow.integration.test.js` |
| `verify-email.js` | `tests/integration/subscriptionFlow.integration.test.js` |
| `verify-firebase.js` | `tests/integration/subscriptionFlow.integration.test.js` |
| `verify-security.js` | `tests/unit/sanitizeService.test.js`, `tests/unit/validateEnv.test.js` |

