'use strict';

const path = require('node:path');
const multer = require('multer');

const allowedReportTypes = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png'
};

const reportUpload = multer({
  storage: multer.memoryStorage(),
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

