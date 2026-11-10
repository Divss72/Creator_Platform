# Pull Request: v0.6 Media & Security Hardening

## Overview

This PR completes **Version 0.6 (v0.6)** of the Creator Economy Platform (CreatorHub), delivering two major pillars:

1. **Media Subsystem**: Post media attachments (images up to 5 MB, videos up to 50 MB) and creator profile avatars (up to 2 MB), backed by an abstracted storage driver architecture (`fake` for development/testing, `cloudinary` for production), with signed ephemeral delivery URLs and strict paywall parity (locked posts reveal zero media URLs or public IDs).
2. **Security Hardening**: Dual-class text safety policy (rich text sanitisation via `sanitize-html`, plain text HTML-rejection), SQL injection defense audit, HTTP security headers (`helmet`), unified CORS policy, multi-tier rate limiting (`express-rate-limit`), GraphQL cost controls (AST root fields cap $\le 10$), socket handshake connection limits (max 20 concurrent per IP), 100 KB payload limits, and strict production startup safety checks.

---

## Key Changes & Implementations

### 1. Storage Driver Architecture (`src/services/storage/`)

- Abstracted driver interface: `upload(file, options)`, `destroy(publicId, resourceType)`, `signedUrl(publicId, options)`.
- **`fakeDriver.js`**: In-memory registry for deterministic local testing with fault-injection simulation (`failNext`). Refused in production mode.
- **`cloudinaryDriver.js`**: Production driver storing post media as authenticated assets (`type: 'authenticated'`) in `creatorhub/{env}/media/{creatorId}/` and generating signed, time-limited URLs.
- **`mediaService.js`**: Framework-independent business logic handling MIME and magic-byte sniffing (via `file-type`), SVG rejection, atomic post attachment caps ($\le 5$) and per-creator storage quotas ($\le 200$ MB) with row-level locks (`SELECT ... FOR UPDATE`), cascade deletion, and signing.

### 2. Database Migrations & Models

- Migration `20261104000001-create-media`: Creates `media` table with foreign keys to `content` and `users` (`ON DELETE CASCADE`), indexes on `(content_id, position)` and `(creator_id)`.
- Migration `20261104000002-add-avatar-public-id-to-creator-profiles`: Adds `avatar_public_id` column to `creator_profiles`.
- Tested and verified clean migration rollback via `npm run db:migrate:undo`.

### 3. Dual-Class Text Safety Policy (`src/services/sanitizeService.js`)

- **Rich Text**: `sanitizeRichText` sanitises post bodies using `sanitize-html`. Preserves safe formatting (`<p>`, `<b>`, `<i>`, `<ul>`, `<code>`, headings), strips dangerous tags (`<script>`, `<iframe>`, `<img>`), strips dangerous attributes (`onerror`, `onclick`), and enforces `rel="noopener noreferrer nofollow"` on all external links.
- **Plain Text**: `cleanPlainText` applies Unicode NFC normalization, strips bidirectional and control characters, and detects HTML tag sequences, rejecting violations with HTTP 400 `VALIDATION_ERROR`. Benign plain text (`"I <3 CreatorHub"`, `"a < b > c"`) is preserved.
- **Excerpt Generation**: `generatePlainTextExcerpt` strips all HTML tags and collapses whitespace, ensuring excerpts never leak tags.
- **Backfill Script**: `scripts/sanitize-backfill.js` providing dry-run and `--apply` batch sanitisation.

### 4. HTTP Hardening, CORS & Rate Limiting

- **Helmet**: Dev-relaxed Content Security Policy for Apollo Sandbox and `/dev/upload`; strict CSP in production.
- **Unified CORS** (`src/config/cors.js`): Single implementation governing REST, `/graphql`, and Socket.io handshakes. Disallows wildcard `*` in production.
- **Multi-Tier Rate Limiters** (`src/middleware/rateLimiters.js`):
  - Global: 120 req/min per IP.
  - Auth Register: 5 req/hr per IP.
  - Auth Login: 10 failed attempts / 15 min per IP (skips successful logins).
  - User Writes: 60 req/15 min per IP.
  - Media Upload: 20 req/hr per IP.
  - Socket Handshake: Max 20 concurrent connections per IP.
- **GraphQL Cost Controls**: AST validation rule `rootFieldsLimit.js` capping root fields and aliases at 10.
- **Request Size Limits**: 100 KB JSON body limit.

### 5. Production Startup Safety Checks (`src/config/env.js`)

In `NODE_ENV=production`, the application refuses to start if:

- `CORS_ORIGIN` contains `*` or is empty.
- `RATE_LIMIT_ENABLED` is false.
- `STORAGE_DRIVER` is set to `fake`.
- `JWT_SECRET` is shorter than 32 characters or matches example defaults.

---

## Verification & Testing

Added automated verification suites:

- `scripts/verify-media.js` (50/50 checks passed)
- `scripts/verify-security.js` (47/47 checks passed)
- `scripts/verify-all.js` running all 6 platform suites in sequence.

## Documentation

- `docs/MEDIA.md`: Complete media architecture, storage drivers, endpoints, and schemas.
- `docs/SECURITY.md`: Comprehensive security hardening guide and threat matrix.
- `requests.http`: Added media upload, delete, avatar, and security test requests.
- `README.md`: Updated environment reference, security section, and API endpoints.
