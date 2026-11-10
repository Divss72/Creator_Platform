'use strict';

const fs = require('fs');
const crypto = require('crypto');
const fileType = require('file-type');
const storageDriver = require('./storage');
const mediaStore = require('../store/mediaStore');
const userStore = require('../store/userStore');
const contentStore = require('../store/contentStore');
const ApiError = require('../utils/apiError');
const env = require('../config/env');
const { MEDIA, ALLOWED_IMAGE_TYPES, ALLOWED_VIDEO_TYPES } = require('../config/limits');
const { cleanPlainText } = require('./sanitizeService');

const ALL_ALLOWED_MIMES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

/**
 * Media Service
 * Handles business validation, storage driver integration, atomic limits, and compensation.
 */
class MediaService {
  /**
   * Sniff real content by examining magic bytes.
   */
  async sniffFile(filePath) {
    try {
      const type = await fileType.fromFile(filePath);
      return type;
    } catch (err) {
      return null;
    }
  }

  /**
   * Validate uploaded post media file (mimetype, sniffed bytes, size limits).
   */
  async validateMediaFile(file) {
    if (!file || !file.path) {
      throw ApiError.badRequest('A file must be uploaded in field "file"', 'VALIDATION_ERROR');
    }

    const declaredMime = (file.mimetype || '').toLowerCase();

    // 1. Check declared mimetype
    if (!ALL_ALLOWED_MIMES.includes(declaredMime) || declaredMime.includes('svg')) {
      throw ApiError.unsupportedMediaType('Unsupported media type');
    }

    // 2. Sniff content bytes
    const sniffed = await this.sniffFile(file.path);
    if (!sniffed || !sniffed.mime) {
      throw ApiError.unsupportedMediaType(
        'Unsupported media type: could not determine file format'
      );
    }

    const sniffedMime = sniffed.mime.toLowerCase();

    // Reject SVG files explicitly
    if (sniffedMime.includes('svg') || declaredMime.includes('svg')) {
      throw ApiError.unsupportedMediaType('SVG files are not permitted');
    }

    // Match declared and sniffed type
    if (!ALL_ALLOWED_MIMES.includes(sniffedMime)) {
      throw ApiError.unsupportedMediaType(`Unsupported media type: ${sniffedMime}`);
    }

    const isImage = ALLOWED_IMAGE_TYPES.includes(declaredMime);
    const isVideo = ALLOWED_VIDEO_TYPES.includes(declaredMime);

    if (isImage && !ALLOWED_IMAGE_TYPES.includes(sniffedMime)) {
      throw ApiError.unsupportedMediaType(
        'Mismatch between declared file type and actual file contents'
      );
    }
    if (isVideo && !ALLOWED_VIDEO_TYPES.includes(sniffedMime)) {
      throw ApiError.unsupportedMediaType(
        'Mismatch between declared file type and actual file contents'
      );
    }

    // 3. File size limits
    if (isImage && file.size > MEDIA.MAX_IMAGE_BYTES) {
      throw ApiError.payloadTooLarge(
        `Image exceeds maximum allowed size of ${Math.round(MEDIA.MAX_IMAGE_BYTES / 1024 / 1024)} MB`
      );
    }
    if (isVideo && file.size > MEDIA.MAX_VIDEO_BYTES) {
      throw ApiError.payloadTooLarge(
        `Video exceeds maximum allowed size of ${Math.round(MEDIA.MAX_VIDEO_BYTES / 1024 / 1024)} MB`
      );
    }

    const kind = isVideo ? 'video' : 'image';
    return {
      kind,
      format: sniffed.ext || (isImage ? 'jpg' : 'mp4'),
      mime: sniffedMime
    };
  }

  /**
   * Upload media and attach to a post.
   */
  async uploadPostMedia({ contentId, creatorId, file }) {
    // 1. Validate file contents and type
    const { kind, format } = await this.validateMediaFile(file);

    // 2. Clean original name
    const rawName = file.originalname || `upload-${Date.now()}.${format}`;
    const originalName = cleanPlainText(rawName, {
      maxLength: 150,
      fieldName: 'File original name'
    });

    // 3. Preliminary limits check before upload (saves Cloudinary bandwidth/credits)
    await mediaStore.checkLimitsPreUpload({
      contentId,
      creatorId,
      newBytes: file.size
    });

    // 4. Upload to storage driver as an AUTHENTICATED asset
    const randomId = crypto.randomUUID();
    const folder = `creatorhub/${env.NODE_ENV}/media/${creatorId}`;

    let uploadResult;
    try {
      uploadResult = await storageDriver.upload(file.path, {
        publicId: randomId,
        folder,
        resourceType: kind,
        type: 'authenticated'
      });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw ApiError.uploadFailed('Failed to upload file to storage driver');
    }

    // 5. Insert row into database with atomic lock
    let mediaRow;
    try {
      mediaRow = await mediaStore.createMediaWithLock({
        contentId,
        creatorId,
        kind,
        publicId: uploadResult.publicId,
        format: uploadResult.format || format,
        bytes: file.size,
        width: uploadResult.width,
        height: uploadResult.height,
        durationSeconds: uploadResult.durationSeconds,
        originalName
      });
    } catch (dbErr) {
      // Compensation: Destroy uploaded asset if DB commit fails
      try {
        await storageDriver.destroy(uploadResult.publicId, {
          resourceType: kind,
          type: 'authenticated'
        });
      } catch (cleanupErr) {
        console.error('[Compensation Cleanup Failed]', uploadResult.publicId, cleanupErr.message);
      }
      throw dbErr;
    }

    // 6. Return allow-listed media object (never expose public_id)
    return {
      id: mediaRow.id,
      kind: mediaRow.kind,
      url: uploadResult.url,
      thumbnailUrl: uploadResult.thumbnailUrl,
      width: mediaRow.width,
      height: mediaRow.height,
      durationSeconds: mediaRow.durationSeconds,
      bytes: mediaRow.bytes,
      position: mediaRow.position
    };
  }

  /**
   * Delete a media item attached to a post.
   */
  async deletePostMedia({ contentId, mediaId, userId }) {
    // 1. Verify post existence and ownership
    const post = await contentStore.findById(contentId);
    if (!post) {
      throw ApiError.notFound('Content not found');
    }
    if (post.creatorId !== userId) {
      throw ApiError.forbidden('You can only delete media on posts you authored');
    }

    // 2. Remove database row inside transaction
    const deleted = await mediaStore.deleteMediaById(contentId, mediaId);
    if (!deleted) {
      throw ApiError.notFound('Media item not found');
    }

    // 3. Destroy asset in storage driver
    await storageDriver.destroy(deleted.publicId, {
      resourceType: deleted.kind,
      type: 'authenticated'
    });

    return true;
  }

  /**
   * Post deletion hook: removes all media records and cleans up storage assets.
   */
  async onPostDeleted(contentId) {
    // 1. Delete all DB rows in transaction and collect public IDs
    const deletedItems = await mediaStore.deleteAllForContent(contentId);

    // 2. Destroy assets post-commit as best-effort (never fail the request)
    // TODO(future): a retry job for failed deletions
    for (const item of deletedItems) {
      try {
        await storageDriver.destroy(item.publicId, {
          resourceType: item.kind,
          type: 'authenticated'
        });
      } catch (err) {
        console.error(
          '[Post Media Cleanup Error] Failed to destroy asset %s:',
          item.publicId,
          err.message
        );
      }
    }
  }

  /**
   * Upload and set creator profile avatar (public asset).
   */
  async uploadAvatar({ creatorId, file }) {
    if (!file || !file.path) {
      throw ApiError.badRequest('A file must be uploaded in field "file"', 'VALIDATION_ERROR');
    }

    // 1. Validate image format
    const declaredMime = (file.mimetype || '').toLowerCase();
    if (!ALLOWED_IMAGE_TYPES.includes(declaredMime) || declaredMime.includes('svg')) {
      throw ApiError.unsupportedMediaType('Avatar must be a valid image (JPEG, PNG, WebP, GIF)');
    }

    const sniffed = await this.sniffFile(file.path);
    if (
      !sniffed ||
      !ALLOWED_IMAGE_TYPES.includes(sniffed.mime.toLowerCase()) ||
      sniffed.mime.includes('svg')
    ) {
      throw ApiError.unsupportedMediaType('Unsupported or corrupted image file for avatar');
    }

    if (file.size > MEDIA.MAX_AVATAR_BYTES) {
      throw ApiError.payloadTooLarge(
        `Avatar exceeds maximum allowed size of ${Math.round(MEDIA.MAX_AVATAR_BYTES / 1024 / 1024)} MB`
      );
    }

    // 2. Upload to storage driver as public asset ('upload')
    const randomId = crypto.randomUUID();
    const folder = `creatorhub/${env.NODE_ENV}/avatars/${creatorId}`;

    let uploadResult;
    try {
      uploadResult = await storageDriver.upload(file.path, {
        publicId: randomId,
        folder,
        resourceType: 'image',
        type: 'upload'
      });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw ApiError.uploadFailed('Failed to upload avatar to storage driver');
    }

    // 3. Update creator profile in database
    const updateResult = await userStore.updateAvatar(creatorId, {
      avatarUrl: uploadResult.url,
      avatarPublicId: uploadResult.publicId
    });

    if (!updateResult) {
      // Compensation: destroy uploaded avatar if user update fails
      await storageDriver.destroy(uploadResult.publicId, { resourceType: 'image', type: 'upload' });
      throw ApiError.notFound('Creator profile not found');
    }

    // 4. Delete old avatar asset if present (best effort)
    if (updateResult.oldAvatarPublicId) {
      try {
        await storageDriver.destroy(updateResult.oldAvatarPublicId, {
          resourceType: 'image',
          type: 'upload'
        });
      } catch (err) {
        console.warn(
          '[Avatar Replacement] Could not destroy old avatar asset:',
          updateResult.oldAvatarPublicId
        );
      }
    }

    return {
      avatarUrl: uploadResult.url
    };
  }

  /**
   * Populate signed URLs on domain media objects for unlocked items.
   */
  signMediaList(mediaItems, hasAccess) {
    if (!hasAccess || !mediaItems || mediaItems.length === 0) {
      return [];
    }

    return mediaItems.map((item) => {
      const url = storageDriver.signedUrl(item.publicId, {
        resourceType: item.kind,
        format: item.format,
        type: 'authenticated'
      });
      const thumbnailUrl = storageDriver.thumbnailUrl(item.publicId, {
        resourceType: item.kind,
        format: item.format,
        type: 'authenticated'
      });

      return {
        id: item.id,
        kind: item.kind,
        url,
        thumbnailUrl,
        width: item.width,
        height: item.height,
        durationSeconds: item.durationSeconds,
        bytes: item.bytes,
        position: item.position
      };
    });
  }
}

module.exports = new MediaService();
