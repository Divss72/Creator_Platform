# Deployment Guide (v0.8)

## Container Specification
The application is packaged as a lightweight, multi-stage Docker image built on `node:22-alpine`:
- **Security**: Runs under unprivileged user `node:node`.
- **Port**: Listens on port `5000` (configurable via `PORT`).
- **Healthcheck**: Regular HTTP health queries against `/health`.
- **Startup Entrypoint**: `scripts/migrate-and-start.js` checks `RUN_MIGRATIONS=true` and runs migrations before launching Express.

## Environment Configuration
Production environments require:
- `NODE_ENV=production`
- `PORT=5000`
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `JWT_SECRET` (min 32 characters, cannot match development example)
- `EMAIL_TOKEN_SECRET` (min 32 characters)
- `CORS_ORIGIN` (explicit HTTPS domain list, no wildcard `*`)
- `STORAGE_DRIVER=cloudinary` (requires `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`)
- `MAIL_DRIVER=smtp` (requires `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`)
- `FIREBASE_DRIVER=firebase` (requires `FIREBASE_DATABASE_URL` and service account credentials)
- `DEPLOY_VERIFY_TOKEN` (secret token for authenticated `/version` queries)
- `RUN_MIGRATIONS=true` (applies pending schema changes on boot)

## Rollback Strategy
1. **Container Image Rollback**: Re-deploy the previously tagged immutable image SHA from GHCR:
   ```bash
   docker pull ghcr.io/<owner>/creatorhub-api:<previous-commit-sha>
   ```
2. **Schema Compatibility**: All database migrations follow the expand-and-contract pattern. New releases maintain backwards-compatibility with previous database schemas.

