# CreatorHub Database Schema (v0.7)

This document provides the Entity-Relationship (ER) diagram, table descriptions, column definitions, and design decisions for the CreatorHub MySQL relational database.

---

## 1. Entity-Relationship (ER) Diagram

```mermaid
erDiagram
    users ||--o| creator_profiles : "has profile (1:1)"
    users ||--o{ content : "authors (1:N)"
    tiers ||--o{ content : "restricts (1:N)"
    users ||--o{ subscriptions : "subscriber (1:N)"
    users ||--o{ subscriptions : "creator (1:N)"
    tiers ||--o{ subscriptions : "tier (1:N)"
    content ||--o{ comments : "contains (1:N)"
    users ||--o{ comments : "writes (1:N)"
    content ||--o{ media : "attaches (1:N)"
    users ||--o{ media : "owns (1:N)"

    users {
        char(36) id PK
        varchar(255) name
        varchar(255) email UK
        varchar(255) password_hash
        enum role "creator, subscriber"
        boolean notify_new_posts "default true"
        boolean notify_weekly_digest "default true"
        datetime created_at
        datetime updated_at
    }

    creator_profiles {
        char(36) id PK
        char(36) user_id FK,UK
        varchar(255) display_name
        text bio
        varchar(255) avatar_url
        varchar(255) avatar_public_id
        datetime created_at
        datetime updated_at
    }

    tiers {
        char(36) id PK
        varchar(50) name UK "free, pro, vip"
        int rank "0, 1, 2"
        int price_cents "0, 500, 1500"
        datetime created_at
        datetime updated_at
    }

    content {
        char(36) id PK
        char(36) creator_id FK
        varchar(255) title
        longtext body
        char(36) min_tier_id FK
        datetime created_at
        datetime updated_at
    }

    media {
        char(36) id PK
        char(36) content_id FK
        char(36) creator_id FK
        enum kind "image, video"
        varchar(255) public_id UK
        varchar(20) format
        bigint bytes
        int width
        int height
        float duration_seconds
        varchar(150) original_name
        int position
        datetime created_at
        datetime updated_at
    }

    subscriptions {
        char(36) id PK
        char(36) subscriber_id FK
        char(36) creator_id FK
        char(36) tier_id FK
        enum status "active, cancelled, expired"
        datetime started_at
        datetime ends_at
        datetime created_at
        datetime updated_at
    }

    comments {
        char(36) id PK
        char(36) content_id FK
        char(36) user_id FK
        text body
        datetime created_at
        datetime updated_at
    }

    email_outbox {
        char(36) id PK
        varchar(255) recipient
        varchar(50) template "welcome, new_post, digest"
        varchar(255) subject
        json payload
        enum status "pending, sending, sent, failed, skipped"
        int attempts "default 0"
        text last_error
        varchar(255) idempotency_key UK
        datetime created_at
        datetime updated_at
    }
```

---

## 2. Table Descriptions

### `users`
Core user identity table supporting both `'creator'` and `'subscriber'` roles.
- `id`: UUID (`CHAR(36)`) primary key.
- `email`: Normalized unique index preventing duplicate registrations.
- `password_hash`: Bcrypt salted hash, never exposed in API responses.
- `role`: Restricted enum (`creator` or `subscriber`).
- `notify_new_posts`: Boolean (default `true`) indicating opt-in preference for new post notification emails.
- `notify_weekly_digest`: Boolean (default `true`) indicating opt-in preference for weekly summary digest emails.

### `creator_profiles`
1-to-1 profile extension for users with the `'creator'` role.
- `user_id`: Unique foreign key referencing `users(id)` with `ON DELETE CASCADE`.
- `display_name`: Public creator name.
- `bio`: Creator biography / channel introduction.
- `avatar_url`: Public delivery URL for creator's avatar.
- `avatar_public_id`: Cloudinary public identifier for the avatar asset, used for asset replacement/deletion cleanup.

### `tiers`
Platform-wide reference table establishing subscription tiers and ordering.
- `name`: Unique name (`'free'`, `'pro'`, `'vip'`).
- `rank`: Numeric hierarchy (`0` for Free, `1` for Pro, `2` for VIP).
- `price_cents`: Simulated monthly price in cents.

### `content`
Posts published by creators.
- `creator_id`: Foreign key referencing `users(id)` with `ON DELETE CASCADE`.
- `min_tier_id`: Foreign key referencing `tiers(id)`.
- **Indexes**:
  - `idx_content_creator_created_at` (`creator_id`, `created_at` DESC).
  - `idx_content_min_tier_id` (`min_tier_id`).

### `media` (Added in v0.6)
Media assets (images and videos) attached to content posts.
- `content_id`: Foreign key referencing `content(id)` with `ON DELETE CASCADE`.
- `creator_id`: Foreign key referencing `users(id)` with `ON DELETE CASCADE`.
- `kind`: Media category (`image` or `video`).
- `public_id`: Cloudinary storage identifier (authenticated asset path; strictly hidden from client API responses).
- `format`: Asset file format (`png`, `jpg`, `mp4`, `webm`).
- `bytes`: File size in bytes.
- `width`, `height`: Visual dimensions.
- `duration_seconds`: Video duration.
- `original_name`: Sanitized original filename for display.
- `position`: Integer attachment order.
- **Indexes**:
  - `idx_media_content_position`: `(content_id, position)`
  - `idx_media_creator`: `(creator_id)`

### `subscriptions`
Records subscriber memberships to specific creators.
- Unique constraint: `(subscriber_id, creator_id)`.

### `comments`
Discussion comments published under content posts.
- `content_id`: Foreign key referencing `content(id)` with `ON DELETE CASCADE`.
- `user_id`: Foreign key referencing `users(id)` with `ON DELETE CASCADE`.
- **Index**: `idx_comments_content_created_at` (`content_id`, `created_at`).

### `email_outbox` (Added in v0.7)
Transactional outbox table for reliable asynchronous email delivery and send-time verification.
- `id`: UUID (`CHAR(36)`) primary key.
- `recipient`: Target email address (`VARCHAR(255)`).
- `template`: Email template identifier (`welcome`, `new_post`, `digest`).
- `subject`: Email subject line (CR/LF sanitized).
- `payload`: Structured JSON containing metadata, template variables, and access-check parameters (`subscriberId`, `creatorId`, `contentId`, `minTierId`).
- `status`: Outbox row lifecycle state (`pending`, `sending`, `sent`, `failed`, `skipped`).
- `attempts`: Count of delivery attempts before permanent failure.
- `last_error`: Text details of transient error or skip reason (e.g. `access_revoked`, `opted_out`).
- `idempotency_key`: Unique string token (e.g., `welcome:${subId}:${creatorId}`, `digest:${userId}:${isoWeek}`) preventing duplicate sends.
- **Indexes**:
  - `idx_email_outbox_status_created`: `(status, created_at)`
  - `idx_email_outbox_idempotency_key`: `(idempotency_key)` UNIQUE

---

## 3. Key Design Decisions

1. **UUID Primary Keys (`CHAR(36)`)**: Maintains exact backward compatibility and prevents sequential ID guessing attacks.
2. **Decoupled Store Layer**: Controllers and GraphQL resolvers never import Sequelize models directly; all database interactions are encapsulated in `src/store/`.
3. **Atomic Quotas & Row Locks**: Media attachment limits ($\le 5$) and creator quotas ($\le 200$ MB) are enforced with `SELECT ... FOR UPDATE` row locks inside managed transactions to eliminate race conditions under parallel uploads.
4. **Cascade Asset Cleanup**: Database foreign keys enforce cascade deletion. When a post or creator is deleted, the storage layer destroys corresponding assets on Cloudinary.
5. **Transactional Outbox & Send-Time Checks**: All outbound notifications are committed to MySQL within domain event listeners, decoupled from the incoming client request. Worker polls with `SELECT ... FOR UPDATE SKIP LOCKED` and re-verifies active tier access right before transmission, guaranteeing zero data leakage even under concurrent cancellation.
