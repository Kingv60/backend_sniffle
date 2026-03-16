const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure upload directory exists
const uploadDir = "uploads/";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// 1. Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Save as: timestamp-originalName
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

// 2. File Filter (Security)
const fileFilter = (req, file, cb) => {

  console.log("Uploaded file:", file.originalname);
  console.log("Mime type:", file.mimetype);

  const allowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/svg+xml",
    "image/gif",
    "video/mp4",
    "video/mpeg",
    "video/quicktime"
  ];

  const allowedExtensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".svg",
    ".gif",
    ".mp4",
    ".mpeg",
    ".mov"
  ];

  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only images and videos are allowed."), false);
  }
};

// 3. The Middleware Instance
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB Limit
  },
});

module.exports = upload;