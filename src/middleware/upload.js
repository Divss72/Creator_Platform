'use strict';

const os = require('os');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { MEDIA } = require('../config/limits');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, os.tmpdir());
  },
  filename: (req, file, cb) => {
    const randomHex = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname) || '';
    cb(null, `creatorhub-${Date.now()}-${randomHex}${ext}`);
  }
});

// Post media upload (max 50 MB, single file in field 'file')
const mediaUpload = multer({
  storage,
  limits: {
    fileSize: MEDIA.MAX_VIDEO_BYTES, // 50 MB max
    files: 1
  }
}).single('file');

// Avatar upload (max 2 MB, single file in field 'file')
const avatarUpload = multer({
  storage,
  limits: {
    fileSize: MEDIA.MAX_AVATAR_BYTES, // 2 MB max
    files: 1
  }
}).single('file');

module.exports = {
  mediaUpload,
  avatarUpload
};

