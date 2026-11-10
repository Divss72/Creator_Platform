# Media Architecture & Specification (v0.6)

This document describes the media subsystem for CreatorHub v0.6, covering asset storage, delivery contracts, security boundaries, and upload workflows.

---

## 1. Overview & Delivery Model

Creators can upload images and videos to enrich their posts, as well as upload a profile avatar.

### Key Principles

1. **Authenticated Delivery**: Post media is NEVER public in Cloudinary. Assets are uploaded under `type: 'authenticated'` into a scoped namespace:
   ```text
   creatorhub/{env}/media/{creatorId}/{random_uuid}
   ```
2. **Ephemeral Signed URLs**: The API hands out short-lived signed URLs (default 1 hour validity) generated on the fly.
3. **Zero Information Leakage**: The paywall applies strictly to media. When a post is locked:
   - `media` is returned as an empty array `[]`.
   - `mediaCount` is returned so viewers know how many attachments exist without leaking metadata.
   - Cloudinary `public_id` is NEVER returned to any client under any circumstance.
4. **Public Avatars**: Creator profile avatars are stored as public assets with standard web-optimized delivery URLs.

---

## 2. Storage Driver Interface

All file storage logic is isolated behind a storage driver interface located in `src/services/storage/`:

- `cloudinaryDriver.js`: Production Cloudinary driver using Cloudinary SDK v2.
- `fakeDriver.js`: In-memory development/test driver providing deterministic signed URLs and fault injection (`failNext('upload'|'destroy')`).

### Interface Contract

Every driver implements three asynchronous functions:

```javascript
/**
 * Upload a local file to storage.
 * @param {string} localFilePath - Path to temporary file on disk
 * @param {Object} options - { folder, publicId, resourceType, type }
 * @returns {Promise<{ publicId: string, format: string, bytes: number, width?: number, height?: number, durationSeconds?: number }>}
 */
upload(localFilePath, options);

/**
 * Destroy an asset from storage.
 * @param {string} publicId - Cloudinary public ID
 * @param {string} resourceType - 'image' | 'video'
 * @returns {Promise<boolean>}
 */
destroy(publicId, resourceType);

/**
 * Generate a signed delivery URL.
 * @param {string} publicId - Cloudinary public ID
 * @param {Object} options - { resourceType, type, expiresInSeconds, transformation }
 * @returns {string} Signed URL
 */
signedUrl(publicId, options);
```

---

## 3. Database Schema

### `media` Table

| Column             | Type                     | Constraints / Attributes             | Description                                       |
| ------------------ | ------------------------ | ------------------------------------ | ------------------------------------------------- |
| `id`               | `CHAR(36)`               | PK, UUID                             | Unique identifier                                 |
| `content_id`       | `CHAR(36)`               | FK -> `content.id` ON DELETE CASCADE | Associated content item                           |
| `creator_id`       | `CHAR(36)`               | FK -> `users.id` ON DELETE CASCADE   | Owner creator                                     |
| `kind`             | `ENUM('image', 'video')` | NOT NULL                             | Media asset category                              |
| `public_id`        | `VARCHAR(255)`           | NOT NULL, UNIQUE                     | Cloudinary storage identifier (hidden from API)   |
| `format`           | `VARCHAR(20)`            | NOT NULL                             | File format extension (`png`, `jpg`, `mp4`, etc.) |
| `bytes`            | `BIGINT UNSIGNED`        | NOT NULL                             | File size in bytes                                |
| `width`            | `INT UNSIGNED`           | NULL                                 | Asset width in pixels                             |
| `height`           | `INT UNSIGNED`           | NULL                                 | Asset height in pixels                            |
| `duration_seconds` | `FLOAT`                  | NULL                                 | Duration for video assets                         |
| `original_name`    | `VARCHAR(150)`           | NOT NULL                             | Sanitized client filename for UI display          |
| `position`         | `INT UNSIGNED`           | NOT NULL, DEFAULT 0                  | Attachment display sequence                       |
| `created_at`       | `DATETIME`               | NOT NULL                             | Creation timestamp                                |
| `updated_at`       | `DATETIME`               | NOT NULL                             | Last update timestamp                             |

**Indexes**:

- `idx_media_content_position`: `(content_id, position)`
- `idx_media_creator`: `(creator_id)`

### `creator_profiles` Table Addition

- `avatar_public_id`: `VARCHAR(255) NULL` — Stores the Cloudinary public ID for the creator's avatar.

---

## 4. Platform Limits & Validation

Defined in `src/config/limits.js`:

- **Image Size Limit**: 5 MB (`image/jpeg`, `image/png`, `image/webp`, `image/gif`)
- **Video Size Limit**: 50 MB (`video/mp4`, `video/webm`)
- **Avatar Size Limit**: 2 MB (images only)
- **Max Attachments per Post**: 5
- **Creator Storage Quota**: 200 MB per creator
- **MIME & Magic Bytes Sniffing**: Validates both the `Content-Type` header and the file's binary header using `file-type`. SVGs are rejected to eliminate SVG-embedded script vectors.
- **Race Condition Prevention**: The attachment limit check and storage quota validation use `SELECT ... FOR UPDATE` row locks inside a managed database transaction.

---

## 5. API Endpoints

### Post Media Upload

`POST /api/content/:id/media`

- **Auth**: Required (`creator` role, must own the post).
- **Body**: `multipart/form-data` with `file` field.
- **Pipeline Order**:
  1. `requireAuth`
  2. `requireRole('creator')`
  3. `mediaUploadLimiter` (rate limiter)
  4. Pre-upload post ownership check
  5. Multer disk streaming (prevents disk exhaustion by unauthenticated actors)
  6. Magic byte sniffing, atomic limit checks, and driver upload
- **Response**: `201 Created` with formatted media object including signed `url` and `thumbnailUrl`.

### Post Media Deletion

`DELETE /api/content/:id/media/:mediaId`

- **Auth**: Required (`creator` role, must own the post).
- **Response**: `204 No Content`. Cascades removal from Cloudinary and deletes database row.

### Creator Avatar Upload

`PUT /api/creators/me/avatar`

- **Auth**: Required (`creator` role).
- **Body**: `multipart/form-data` with `file` field.
- **Response**: `200 OK` with updated profile and `avatarUrl`. Old avatar asset is deleted from storage automatically.
