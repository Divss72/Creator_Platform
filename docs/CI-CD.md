# CI/CD Pipeline (v0.8)

## GitHub Actions Workflows

### Continuous Integration (`ci.yml`)

Runs automatically on pushes to `main`, `develop`, and `feature/*`, and on pull requests targeting `main` and `develop`.
Jobs:

1. **lint**:
   - Enforces architectural boundaries via ESLint (`no-restricted-imports`, `no-restricted-syntax`).
   - Ensures no controllers, handlers, listeners, or jobs import Sequelize or models directly.
   - Verifies code style with Prettier.
2. **unit**:
   - Executes Jest unit test suites with coverage tracking.
3. **integration**:
   - Spins up MySQL 8.0 service container.
   - Runs database migrations and seeds.
   - Executes full integration test suite against `creatorhub_test`.
4. **security**:
   - Runs `npm audit` to detect known high-severity vulnerabilities.
5. **image**:
   - Builds production multi-stage Docker image.
   - Spins up a test container and runs `scripts/smoke-test.js` against the live HTTP server.
6. **ci-ok**:
   - Required status check gate depending on all 5 prerequisite jobs.

### Continuous Deployment (`cd.yml`)

Triggered on push to `main`:

1. **publish-image**:
   - Builds container and publishes tagged images to GitHub Container Registry (`ghcr.io`).
2. **deploy**:
   - Gated by repository variable `DEPLOY_ENABLED === 'true'`.
   - Triggers production deployment and post-deploy health verification.
