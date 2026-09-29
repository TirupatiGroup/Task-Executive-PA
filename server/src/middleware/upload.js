// Multer upload middleware for task attachments.

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const express = require('express');
const { ValidationError } = require('../utils/errors');

const projectRoot = path.resolve(__dirname, '..', '..');
const UPLOAD_DIR = path.resolve(projectRoot, '..', 'uploads', 'tasks');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function sanitizeFilename(name) {
  if (!name) return 'file';
  const sanitized = String(name)
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\.+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .trim();
  return sanitized || 'file';
}

const ALLOWED_MIME = [
  /^image\//,
  'application/pdf',
  'text/plain',
];

function fileFilter(req, file, cb) {
  const mimeType = file.mimetype;
  const allowed = ALLOWED_MIME.some((pattern) =>
    pattern instanceof RegExp ? pattern.test(mimeType) : pattern === mimeType
  );
  if (allowed) return cb(null, true);
  cb(new ValidationError('File type not allowed. Accepts images, PDF, and plain text.'));
}

function generateRandom16Hex() {
  return crypto.randomBytes(8).toString('hex');
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ts = Date.now();
    const rand = generateRandom16Hex();
    const sanitized = sanitizeFilename(file.originalname);
    cb(null, `${ts}-${rand}-${sanitized}`);
  },
});

const uploadSingle = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter,
}).single('file');

function serveUploads(app) {
  app.use('/uploads/tasks', express.static(UPLOAD_DIR));
}

module.exports = { uploadSingle, sanitizeFilename, UPLOAD_DIR, serveUploads };
