'use strict';

const cloudinary = require('cloudinary').v2;
const env = require('../../config/env');
const ApiError = require('../../utils/apiError');

// Configure Cloudinary once
if (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true
  });
}

class CloudinaryDriver {
  /**
   * Upload file to Cloudinary.
   */
  async upload(filePath, options = {}) {
    const {
      publicId,
      resourceType = 'image',
      type = 'authenticated',
      folder = ''
    } = options;

    try {
      const uploadOptions = {
        resource_type: resourceType,
        type,
        folder,
        public_id: publicId,
        overwrite: true
      };

      const result = await cloudinary.uploader.upload(filePath, uploadOptions);

      const url = this.signedUrl(result.public_id, {
        resourceType,
        format: result.format,
        type
      });

      const thumbnailUrl = this.thumbnailUrl(result.public_id, {
        resourceType,
        format: result.format,
        type
      });

      return {
        publicId: result.public_id,
        resourceType,
        format: result.format,
        bytes: result.bytes,
        width: result.width || null,
        height: result.height || null,
        durationSeconds: result.duration || null,
        type,
        url,
        thumbnailUrl
      };
    } catch (err) {
      console.error('[Cloudinary Upload Error]', err.message);
      throw ApiError.uploadFailed('Failed to upload file to storage');
    }
  }

  /**
   * Delete asset from Cloudinary.
   */
  async destroy(publicId, options = {}) {
    const { resourceType = 'image', type = 'authenticated' } = options;
    try {
      const res = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
        type,
        invalidate: true
      });
      return res && (res.result === 'ok' || res.result === 'not found');
    } catch (err) {
      console.error('[Cloudinary Destroy Error]', publicId, err.message);
      return false;
    }
  }

  /**
   * Generates a signed transformed delivery URL on the fly (in-memory HMAC, zero network calls).
   * Transforms: quality auto, format auto, images limited to 1600px wide.
   */
  signedUrl(publicId, options = {}) {
    const { resourceType = 'image', type = 'authenticated' } = options;

    const transformation = [
      { quality: 'auto', fetch_format: 'auto' }
    ];

    if (resourceType === 'image') {
      transformation.push({ width: 1600, crop: 'limit' });
    }

    return cloudinary.url(publicId, {
      resource_type: resourceType,
      type,
      sign_url: type === 'authenticated',
      secure: true,
      transformation
    });
  }

  /**
   * Generates thumbnail URL:
   * - Images: 400x300 fill, quality auto, format auto
   * - Videos: poster frame as image, 400x300 fill
   */
  thumbnailUrl(publicId, options = {}) {
    const { resourceType = 'image', type = 'authenticated' } = options;

    if (resourceType === 'video') {
      return cloudinary.url(publicId, {
        resource_type: 'video',
        format: 'jpg',
        type,
        sign_url: type === 'authenticated',
        secure: true,
        transformation: [
          { width: 400, height: 300, crop: 'fill', quality: 'auto' }
        ]
      });
    }

    return cloudinary.url(publicId, {
      resource_type: 'image',
      type,
      sign_url: type === 'authenticated',
      secure: true,
      transformation: [
        { width: 400, height: 300, crop: 'fill', quality: 'auto', fetch_format: 'auto' }
      ]
    });
  }
}

module.exports = new CloudinaryDriver();
