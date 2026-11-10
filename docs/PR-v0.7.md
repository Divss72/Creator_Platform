# Pull Request: v0.7 - Email Notifications & Firebase Live Subscriber Count

## Summary

Implements Version 7 (v0.7) of CreatorHub:

1. **Email Subsystem**:
   - Transactional Outbox pattern via `email_outbox` table with `dedupe_key` uniqueness constraint.
   - Welcome email on subscription creation and reactivation.
   - Keyset-paginated new-post email fan-out to eligible active subscribers with tier rank enforcement and zero secret body leakage.
   - Weekly digest generator with ISO-week deduplication and configurable `node-cron` schedule.
   - User notification preferences API (`GET/PUT /api/notifications/preferences`).
   - HMAC-SHA256 signed one-click unsubscribe links supporting RFC 8058.
   - Worker batch claiming via MySQL 8 `SELECT ... FOR UPDATE SKIP LOCKED` with transient retries, exponential delay backoff, stuck row recovery, and daily recipient abuse caps.
   - Pluggable mail driver architecture (`log` and `nodemailer` `smtp`).
2. **Firebase Subsystem**:
   - Live subscriber metrics mirrored to Firebase Realtime Database at `creatorStats/{creatorId}` with total and per-tier counts (`free`, `pro`, `vip`).
   - Event-driven synchronization debounced per creator (`FIREBASE_SYNC_DEBOUNCE_MS`) to coalesce rapid bursts into a single write.
   - Custom Firebase auth token minting (`GET /api/creators/me/firebase-token`) restricted to creators.
   - Realtime Database security rules (`firebase/database.rules.json`) strictly enforcing read-only access for creator's own UID and no client writes.
   - REST dashboard fallback endpoint (`GET /api/creators/me/dashboard/subscribers`).
   - Hourly reconciliation job and on-demand resync CLI script.
3. **Strict Side-Effect Isolation**:
   - All email and Firebase operations are fire-and-forget side effects that never block, fail, or roll back REST, GraphQL, or Socket.io operations.

---

## Changes

- **Database**:
  - Migration `20261109000001-add-notification-preferences-to-users.js`: Adds `notify_new_posts` and `notify_weekly_digest` boolean columns to `users`.
  - Migration `20261109000002-create-email-outbox.js`: Creates `email_outbox` table with status and deduplication indexes.
- **Drivers**:
  - `src/services/mail/`: Driver interface with `logDriver.js` and `smtpDriver.js`.
  - `src/services/firebase/`: Driver interface with `fakeDriver.js` and `firebaseDriver.js`.
- **Services & Workers**:
  - `src/services/notificationService.js`: Welcome and fan-out enqueuing.
  - `src/services/outboxService.js`: Outbox processing, HMAC unsubscribe tokens, eligibility re-checks.
  - `src/services/digestService.js`: Weekly digest compilation.
  - `src/services/firebaseSyncService.js`: Realtime debounced metrics sync.
  - `src/jobs/emailWorker.js`: Background polling outbox processor.
  - `src/jobs/digestJob.js`: Weekly cron scheduler.
  - `src/jobs/firebaseReconcileJob.js`: Hourly database reconciliation.
- **Routes & Controllers**:
  - `src/controllers/notifications.controller.js` & `src/routes/notifications.routes.js`: Preferences API.
  - `src/controllers/email.controller.js` & `src/routes/email.routes.js`: Unsubscribe endpoints.
  - `src/controllers/creators.controller.js`: Custom token and subscriber metrics fallback endpoints.
- **Dev Endpoints**:
  - `/dev/mail`, `/dev/mail/:id/html`, `/dev/mail/fail-next`, `/dev/mail/fail-all`, `/dev/mail/clear`
  - `/dev/firebase`, `/dev/firebase/set`, `/dev/firebase/fail-next`, `/dev/firebase/fail-all`, `/dev/firebase/clear`
- **Verification Suites**:
  - `scripts/verify-email.js`: Comprehensive 33-point email test suite.
  - `scripts/verify-firebase.js`: Comprehensive 29-point Firebase test suite.
  - `scripts/verify-all.js`: Updated unified runner including v0.7 suites.

---

## Verification

All 8 verification suites run and pass sequentially via `npm run verify:all`.
