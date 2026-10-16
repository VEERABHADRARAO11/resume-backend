const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueName = `${Date.now()}-${sanitizedName}`;
    cb(null, uniqueName);
  },
});

// File filter: Allow only PDF
const fileFilter = (req, file, cb) => {
  const isPdfExt = path.extname(file.originalname).toLowerCase() === '.pdf';
  const isPdfMime = file.mimetype === 'application/pdf';

  if (isPdfExt && isPdfMime) {
    cb(null, true);
  } else {
    const error = new Error('Invalid file type. Only PDF files are allowed.');
    error.code = 'INVALID_FILE_TYPE';
    cb(error, false);
  }
};

// 5 MB max limit
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB in bytes
  },
});

module.exports = upload;
