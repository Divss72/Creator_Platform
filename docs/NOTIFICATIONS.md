# Email Notifications & Outbox Subsystem (v0.7)

## Overview

CreatorHub v0.7 introduces an asynchronous, transactional email notification subsystem built around the **Transactional Outbox Pattern**. All emails triggered by user events (subscriptions, published posts, weekly digests) are written to MySQL in the same transaction or immediately post-commit, guaranteeing zero data loss, decoupling API response times from SMTP latency, and enforcing strict side-effect isolation.

---

## 1. Architecture: The Transactional Outbox Pattern

```
                       ┌─────────────────────────┐
                       │ Domain Event / API Write │
                       └────────────┬────────────┘
                                    │ (Post-commit)
                                    ▼
                       ┌─────────────────────────┐
                       │   NotificationService   │
                       └────────────┬────────────┘
                                    │ Enqueue
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          MySQL: email_outbox                           │
│  [id, type, user_id, to_email, subject, html, text, dedupe_key, status]│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    │ SELECT ... FOR UPDATE SKIP LOCKED
                                    │ (Batch claim: status -> 'sending')
                                    ▼
                       ┌─────────────────────────┐
                       │       EmailWorker       │
                       └────────────┬────────────┘
                                    │
             ┌──────────────────────┴──────────────────────┐
             │ Send-Time Verification Checks               │
             │ - Daily recipient abuse cap (<= 20/day)     │
             │ - Fresh user notification preferences       │
             │ - Fresh subscription rank check             │
             └──────────────────────┬──────────────────────┘
                                    │ Passed
                                    ▼
                       ┌─────────────────────────┐
                       │       MailDriver        │
                       │   (LogDriver / Smtp)    │
                       └────────────┬────────────┘
                                    │
                     ┌──────────────┴──────────────┐
                     │                             │
                  Success                       Failure
                     │                             │
                     ▼                             ▼
             Mark status: 'sent'           Transient?
             Record: sent_at               ├─ Yes: status: 'pending', next_attempt_at
                                           └─ No:  status: 'failed', last_error
```

### Outbox State Machine

- `pending`: Enqueued and waiting for worker claim.
- `sending`: Claimed by a worker via `SELECT ... FOR UPDATE SKIP LOCKED`.
- `sent`: Successfully delivered to mail transport.
- `failed`: Terminal failure after exceeding `EMAIL_MAX_ATTEMPTS` or permanent error.
- `skipped`: Bypassed due to access revocation, user opt-out, or daily abuse cap.

---

## 2. Notification Types & Triggers

### A. Welcome Email

- **Trigger**: New or reactivated subscription.
- **Dedupe Key**: `welcome:${subscriberId}:${creatorId}:${tier}`
- **Content**: Welcome greeting, creator name, subscribed tier badge, community guidelines.
- **Headers**: RFC 8058 `List-Unsubscribe` and `List-Unsubscribe-Post`.

### B. New-Post Email Fan-Out

- **Trigger**: Creator publishes a new post (`POST /api/content`).
- **Fan-Out Loop**: Keyset pagination query (`WHERE subscriber_id > :lastId ORDER BY subscriber_id ASC LIMIT 100`) to prevent high memory usage.
- **Eligibility**:
  - Subscription status is active (`ends_at IS NULL OR ends_at > NOW()`).
  - Subscriber tier rank $\ge$ post `minTierRank`.
  - Subscriber preference `notify_new_posts = true`.
- **Dedupe Key**: `post:${subscriberId}:${contentId}`
- **Security & Privacy**:
  - Never leaks post body HTML or attachments.
  - Plain-text excerpt only (max 200 characters).
  - Clean subject line ($\le 150$ characters, stripped of CR/LF injection characters).

### C. Weekly Digest

- **Trigger**: Scheduled cron job (`DIGEST_CRON`, default Mondays at 09:00 in `DIGEST_TIMEZONE`) or CLI command (`npm run digest:run`).
- **Algorithm**:
  1. Finds all users with `notify_weekly_digest = true`.
  2. Queries active subscriptions for each user.
  3. Queries posts published in the last 7 days (`created_at >= NOW() - 7 DAYS`) by those creators.
  4. Filters posts by the subscriber's effective tier rank for each creator.
  5. Groups posts by creator, capped at `DIGEST_MAX_POSTS` (default 10).
  6. Enqueues digest with dedupe key `digest:${subscriberId}:${isoWeek}`.

---

## 3. Preferences & Unsubscribe Endpoints

### Preferences API

- `GET /api/notifications/preferences`: Returns `{ notifyNewPosts: boolean, notifyWeeklyDigest: boolean }`.
- `PUT /api/notifications/preferences`: Updates notification preferences.

### HMAC One-Click Unsubscribe

- **Token Format**: `base64url(userId.type.expiresAt.signature)`
- **HMAC Secret**: `EMAIL_TOKEN_SECRET` (minimum 32 characters in production).
- **Public Endpoints**:
  - `GET /api/email/unsubscribe?token=...`: User-facing one-click unsubscribe.
  - `POST /api/email/unsubscribe?token=...`: RFC 8058 standard one-click handler.
- **Rate Limit**: 30 requests / hour per IP (`unsubscribeLimiter`).

---

## 4. Reliability & Recovery

- **Token Bucket Rate Limiting**: Workers pace outgoing sends according to `EMAIL_RATE_LIMIT_PER_SEC` (default 10/sec).
- **Exponential Retry Delays**: Configured in `EMAIL_RETRY_DELAYS_SECONDS` (`60, 300, 900, 3600, 14400`).
- **Stuck Row Recovery**: Rows stuck in `sending` state $> 5$ minutes (e.g. from container restart) are automatically reclaimed back to `pending`.
- **Retention Purge**: Daily job purges `sent` records older than 30 days and `failed`/`skipped` records older than 60 days.
