const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const IMAGES_DIR = path.resolve(__dirname, '..', '..', 'images');

if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, and WebP images are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

const processImage = async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Product image is required.' });
  }

  try {
    const filename = Date.now() + '.webp';
    const filepath = path.join(IMAGES_DIR, filename);

    await sharp(req.file.buffer)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(filepath);

    req.file.filename = filename;
    next();
  } catch (error) {
    return res.status(500).json({ error: 'Image processing failed.' });
  }
};

module.exports = { upload, processImage, IMAGES_DIR };
