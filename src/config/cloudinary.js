const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

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
      const isSvg = file.mimetype === 'image/svg+xml' || file.originalname.toLowerCase().endsWith('.svg');

      
      return {
        folder: 'skillconnect_media',
        resource_type: isSvg ? 'image' : 'auto',
        format: isSvg ? 'svg' : undefined,
        quality: 'auto',
        flags: isSvg ? undefined : 'sanitize',
        allowed_formats: ['jpg', 'png', 'svg', 'mp4', 'jpeg', 'gif', 'mov', 'mpeg', 'webp', 'bmp', 'tiff', 'ico'],
        eager: isSvg ? undefined : [
          {
            width: 320,
            height: 240,
            crop: 'thumb',
            gravity: 'south',
          },
        ],
      };
    },
  });

  upload = multer({ storage });
}

module.exports = { cloudinary, upload };
