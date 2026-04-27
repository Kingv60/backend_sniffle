const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

let upload = null;

if (cloudName && apiKey && apiSecret) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });

  const storage = new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => {
      const ext = file.originalname.toLowerCase();
      const mime = file.mimetype;

      const isSvg =
        mime === "image/svg+xml" ||
        ext.endsWith(".svg");

      if (isSvg) {
        return {
          folder: "skillconnect_media",
          resource_type: "image",
          format: "svg",
          public_id: `${Date.now()}-${file.originalname.replace(/\.[^/.]+$/, "")}`,
        };
      }

      return {
        folder: "skillconnect_media",
        resource_type: "auto",
        quality: "auto",
        flags: "sanitize",
        allowed_formats: [
          "jpg",
          "jpeg",
          "png",
          "gif",
          "webp",
          "bmp",
          "tiff",
          "ico",
          "mp4",
          "mov",
          "mpeg",
          "avi",
          "pdf",
          "doc",
          "docx",
          "txt"
        ],
        eager: [
          {
            width: 320,
            height: 240,
            crop: "thumb",
            gravity: "south",
          },
        ],
      };
    },
  });

  upload = multer({
    storage,
    limits: {
      fileSize: 500 * 1024 * 1024,
    },
  });
}

module.exports = { cloudinary, upload };
