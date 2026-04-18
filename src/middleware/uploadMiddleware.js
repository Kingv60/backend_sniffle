const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { upload: cloudinaryUpload } = require("../config/cloudinary");

const localUploadDir = "uploads/";
if (!fs.existsSync(localUploadDir)) {
  fs.mkdirSync(localUploadDir);
}

const localStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, localUploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const fileFilter = (req, file, cb) => {
  console.log("Upload attempt:", {
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size
  });

  const allowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/svg+xml",
    "image/gif",
    "image/webp",
    "image/bmp",
    "image/tiff",
    "image/x-icon",
    "video/mp4",
    "video/mpeg",
    "video/quicktime",
    "video/x-msvideo",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
  ];

  const allowedExtensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".svg",
    ".gif",
    ".mp4",
    ".mpeg",
    ".mov",
    ".avi",
    ".pdf",
    ".doc",
    ".docx",
    ".txt",
    ".webp",
    ".bmp",
    ".tiff",
    ".ico",
  ];

  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file format. Allowed: ${allowedExtensions.join(', ')}`), false);
  }
};

const standardUpload = multer({
  storage: localStorage,
  fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024,
  },
});

const upload = cloudinaryUpload || standardUpload;

module.exports = upload;
