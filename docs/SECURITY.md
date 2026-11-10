# Security Architecture & Hardening Guide (v0.7)

This document details the security posture, defensive controls, and architectural guarantees implemented in CreatorHub v0.7.

---

## 1. Threat Mitigation Matrix

| Threat Category                              | Potential Attack Vector                                                   | Defensive Controls                                                                                                                                                                                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stored Cross-Site Scripting (XSS)**        | Post body containing `<script>`, `onerror`, `javascript:`, malicious HTML | Dual-class text policy: `sanitizeRichText` uses `sanitize-html` to whitelist safe tags, strip script/styles, and enforce `rel="noopener noreferrer nofollow"` on all external links.                                                                    |
| **HTML Injection in Metadata**               | Titles, comments, creator bios, names with HTML tags                      | Strict plain-text rejection: `cleanPlainText` runs Unicode NFC normalization, strips bidirectional and control characters, and detects HTML tags with regex, rejecting violations with HTTP 400 `VALIDATION_ERROR`.                                     |
| **SQL Injection (SQLi)**                     | Parameter tampering in path IDs, query strings, login, registration       | Parameterized Sequelize queries exclusively across `src/store/`. Path parameters validated via Zod UUID schemas (`isValidUUID`). Zero raw SQL query string interpolation (verified by static audit).                                                    |
| **Denial of Service (DoS) & Brute Force**    | Rapid authentication attempts, endpoint flooding, connection exhaustion   | Multi-tier rate limiting via `express-rate-limit`: Global limiter (120 req/min), Auth Login limiter (10 failed attempts / 15 min, skips success), User Writes limiter (60 req/15 min), Upload limiter (20 req/hr), Unsubscribe limiter (10 req/15 min). |
| **GraphQL Alias Flooding & Query Cost**      | Deeply nested queries or massive alias lists exhausting resolver compute  | AST Cost Validation (`createRootFieldsLimitRule`) caps root fields and aliases at 10. Depth limiter caps nesting depth at 6.                                                                                                                            |
| **Realtime Socket Exhaustion**               | Opening hundreds of idle socket connections per client IP                 | Handshake IP rate limiter restricts concurrent socket connections to maximum 20 per client IP. In-session anti-spam limiter caps comments at 5 per 10s per socket.                                                                                      |
| **Payload Flooding / Disk Abuse**            | Massive JSON bodies or multi-gigabyte file uploads                        | Express JSON body limit strictly set to 100 KB. Multer file limits set to 5 MB for images, 50 MB for videos, and 2 MB for avatars. Ownership & role authentication run BEFORE multer disk streaming.                                                    |
| **Email Forgery & Unauthorized Unsubscribe** | Forged links modifying subscriber notification preferences                | Tamper-proof HMAC-SHA256 tokens (`EMAIL_TOKEN_SECRET`) encoding `userId`, `category`, and `expiresAt` with constant-time verification. Tampered or expired signatures return HTTP 400.                                                                  |
| **Unauthorized Firebase Realtime Access**    | Malicious subscribers eavesdropping on private creator metrics            | Client read locked to `auth.uid == $creatorId` in `firebase/database.rules.json`. Client writes are strictly disabled (`.write: false`). Tokens minted strictly for authenticated creators.                                                             |
| **Insecure Production Deployment**           | Leaving debug or permissive configuration active                          | Production startup safety checks in `src/config/env.js` refuse to boot if `CORS_ORIGIN=*`, `RATE_LIMIT_ENABLED=false`, `STORAGE_DRIVER=fake`, or `JWT_SECRET` / `EMAIL_TOKEN_SECRET` is shorter than 32 characters.                                     |

---

## 2. Dual-Class Text Safety Policy

CreatorHub enforces a strict separation between rich-text content and plain-text fields:

### Class 1: Rich Text (`body` of Content items)

- Processed via `sanitizeService.sanitizeRichText(body)`.
- **Allowed Tags**: `b`, `i`, `em`, `strong`, `a`, `p`, `br`, `ul`, `ol`, `li`, `blockquote`, `code`, `pre`, `h2`, `h3`, `h4`.
- **Allowed Attributes**: `href` on `<a>` tags (restricted to `http`, `https`, `mailto`).
- **Enforced Attributes**: All `<a>` tags receive `rel="noopener noreferrer nofollow"`.
- **Disallowed**: `<script>`, `<style>`, `<iframe>`, `<object>`, `<embed>`, `<form>`, `<input>`, `<img>` (post images are managed via the media subsystem), event handlers (`onclick`, `onerror`, `onload`).

### Class 2: Plain Text (Titles, Comments, Names, Display Names, Bios, Filenames)

- Processed via `sanitizeService.cleanPlainText(text, options)`.
- Unicode NFC normalization.
- Rejection of HTML tag sequences with `ApiError.validation('... must not contain HTML or tag-like content')`.
- Allows natural mathematical and conversational text such as `"I <3 CreatorHub"` and `"a < b > c"`.

### Excerpt Generation

- Derived from the post body using `sanitizeService.generatePlainTextExcerpt(body, 200)`.
- Strips all HTML tags and collapses whitespace, guaranteeing previews contain only safe plain text.

---

## 3. Email Security & HMAC Token Verification

- **HMAC-SHA256 Signatures**: All one-click unsubscribe links and headers (`List-Unsubscribe`, `List-Unsubscribe-Post: List-Unsubscribe=One-Click` per RFC 8058) contain a signed URL token containing base64 payload `{ userId, category, expiresAt }` and hex HMAC digest.
- **Constant-Time Verification**: Validated using `crypto.timingSafeEqual` in `src/services/notificationService.js` to eliminate timing side-channel attacks.
- **Expiration**: Unsubscribe links automatically expire after 30 days.
- **Dedicated Rate Limiting**: The public `/api/email/unsubscribe` route is protected by `unsubscribeLimiter` (10 requests per 15 minutes per IP).

---

## 4. Firebase Realtime Database Security & Token Architecture

- **Custom Auth Tokens**: Creators authenticate to the Firebase Realtime Database using short-lived custom tokens generated by `firebase-admin` via `GET /api/creators/me/firebase-token`. The endpoint enforces creator authentication; subscribers receive HTTP 403 Forbidden.
- **Declarative Security Rules (`firebase/database.rules.json`)**:
  - `creatorStats/{creatorId}` read access requires `auth.uid === $creatorId`.
  - Client writes are completely disabled (`.write: false`).
  - No subscriber or anonymous viewer can read creator metrics or overwrite statistics directly.

---

## 5. HTTP Security Headers (Helmet)

CreatorHub mounts `helmet` in `src/app.js`:

- In **Development**: Relaxed Content Security Policy (`script-src`, `connect-src`) to allow Apollo Sandbox and the dev upload tool (`/dev/upload`).
- In **Production**: Strict CSP (`default-src 'self'`), `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, and strict referrers.

---

## 6. Unified CORS Policy

Located in `src/config/cors.js`, a single CORS policy governs Express REST routes, the Apollo GraphQL endpoint, and Socket.io handshakes:

- Configured via comma-delimited `CORS_ORIGIN` environment variable.
- In production, wildcard `*` is strictly forbidden and triggers a fatal boot error.
- Disallowed origins receive no `Access-Control-Allow-Origin` header and are rejected at the Socket handshake with an authentication/origin error.
