'use strict';

const fs = require('fs');
const mediaService = require('../services/mediaService');

/**
 * Media Controller
 */
const mediaController = {
  /**
   * Upload post media (Owner creator only)
   * Pipeline order: Auth, Role, Rate Limit, Ownership checked BEFORE multer.
   */
  async uploadMedia(req, res) {
    try {
      const media = await mediaService.uploadPostMedia({
        contentId: req.params.id,
        creatorId: req.user.id,
        file: req.file
      });

      res.status(201).json({ media });
    } finally {
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (_) {}
      }
    }
  },

  /**
   * Delete post media (Owner creator only)
   */
  async deleteMedia(req, res) {
    await mediaService.deletePostMedia({
      contentId: req.params.id,
      mediaId: req.params.mediaId,
      userId: req.user.id
    });

    res.status(204).send();
  },

  /**
   * Upload creator avatar
   */
  async uploadAvatar(req, res) {
    try {
      const result = await mediaService.uploadAvatar({
        creatorId: req.user.id,
        file: req.file
      });

      res.status(200).json(result);
    } finally {
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (_) {}
      }
    }
  }
};

module.exports = mediaController;

