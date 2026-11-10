'use strict';

const fs = require('fs');
const ApiError = require('../../utils/apiError');

/**
 * In-memory Fake Storage Driver
 * Used for development and verification testing without requiring real Cloudinary credentials.
 * Stores nothing on disk, maintains in-memory registry of public_ids, and returns deterministic URLs.
 */
class FakeDriver {
  constructor() {
    this.registry = new Map(); // publicId -> assetMetadata
    this.nextFailOp = null; // 'upload' | 'destroy' | null
  }

  /**
   * Set failure hook for testing error compensation and cleanup tolerance.
   * @param {'upload'|'destroy'|null} op
   */
  failNext(op) {
    this.nextFailOp = op;
  }

  getRegistry() {
    return Array.from(this.registry.values());
  }

  reset() {
    this.registry.clear();
    this.nextFailOp = null;
  }

  /**
   * Mock upload: reads file stats and registers asset metadata in memory.
   */
  async upload(filePath, options = {}) {
    if (this.nextFailOp === 'upload') {
      this.nextFailOp = null;
      throw ApiError.uploadFailed('Simulated fake storage upload failure');
    }

    const {
      publicId,
      resourceType = 'image',
      format = resourceType === 'video' ? 'mp4' : 'png',
      width = resourceType === 'video' ? 1920 : 1200,
      height = resourceType === 'video' ? 1080 : 800,
      durationSeconds = resourceType === 'video' ? 12.5 : null,
      type = 'authenticated',
      folder = ''
    } = options;

    let bytes = 1024;
    try {
      if (filePath && fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        bytes = stats.size;
      }
    } catch (_) {
      bytes = 1024;
    }

    const fullPublicId = folder ? `${folder}/${publicId}` : publicId;

    const assetMeta = {
      publicId: fullPublicId,
      rawId: publicId,
      resourceType,
      format,
      bytes,
      width,
      height,
      durationSeconds,
      type,
      folder,
      createdAt: new Date().toISOString()
    };

    this.registry.set(fullPublicId, assetMeta);

    const url = this.signedUrl(fullPublicId, { resourceType, format, type });
    const thumbnailUrl = this.thumbnailUrl(fullPublicId, { resourceType, format, type });

    return {
      ...assetMeta,
      url,
      thumbnailUrl
    };
  }

  /**
   * Mock asset deletion.
   */
  async destroy(publicId, options = {}) {
    if (this.nextFailOp === 'destroy') {
      this.nextFailOp = null;
      throw new Error(`Simulated fake storage destroy failure for ${publicId}`);
    }

    if (!publicId) return false;

    // Handle both raw publicId and folder-prefixed publicId
    let found = this.registry.delete(publicId);
    if (!found) {
      for (const [key, val] of this.registry.entries()) {
        if (key.endsWith(`/${publicId}`) || val.rawId === publicId) {
          this.registry.delete(key);
          found = true;
          break;
        }
      }
    }

    return found;
  }

  /**
   * Deterministic fake delivery URL generated locally.
   */
  signedUrl(publicId, options = {}) {
    const { format = 'jpg', resourceType = 'image' } = options;
    const safeId = encodeURIComponent(publicId).replace(/%2F/g, '/');
    return `https://fake-storage.creatorhub.local/${resourceType}/authenticated/${safeId}.${format}?s=fake_sig_${Date.now()}`;
  }

  /**
   * Deterministic fake thumbnail URL generated locally.
   */
  thumbnailUrl(publicId, options = {}) {
    const { resourceType = 'image' } = options;
    const safeId = encodeURIComponent(publicId).replace(/%2F/g, '/');
    const ext = resourceType === 'video' ? 'jpg' : options.format || 'jpg';
    return `https://fake-storage.creatorhub.local/${resourceType}/thumb/${safeId}.${ext}?s=fake_thumb_sig`;
  }
}

module.exports = new FakeDriver();
