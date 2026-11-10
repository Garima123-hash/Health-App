'use strict';

const path = require('node:path');
const crypto = require('node:crypto');
const multer = require('multer');
const { UPLOAD_DIR } = require('../config');

const allowedReportTypes = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png'
};

const reportStorage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, UPLOAD_DIR),
  filename: (_req, file, callback) =>
    callback(
      null,
      `${process.env.CARESPHERE_UPLOAD_PREFIX || ''}${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`
    )
});

const reportUpload = multer({
  storage: reportStorage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!allowedReportTypes[extension] || allowedReportTypes[extension] !== file.mimetype) {
      return callback(new Error('Only PDF, JPG and PNG files are allowed.'));
    }
    return callback(null, true);
  }
});

module.exports = {
  allowedReportTypes,
  reportUpload
};
