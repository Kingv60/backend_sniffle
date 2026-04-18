const fs = require('fs');

function getUploadUrl(file) {
  if (!file) return null;

  if (file.secure_url) return file.secure_url;
  if (file.path && typeof file.path === 'string') return file.path;
  if (file.url) return file.url;
  if (file.filename) return `/uploads/${file.filename}`;

  return null;
}

function isLocalUpload(file) {
  return file && typeof file.path === 'string' && !file.path.startsWith('http');
}

function removeLocalUpload(file) {
  if (isLocalUpload(file) && fs.existsSync(file.path)) {
    fs.unlinkSync(file.path);
  }
}

function isLocalUrl(url) {
  return typeof url === 'string' && url.startsWith('/uploads/');
}

module.exports = { getUploadUrl, isLocalUpload, removeLocalUpload, isLocalUrl };
