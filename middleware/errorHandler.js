const multer = require('multer');

// Centralized error handling middleware
function errorHandler(err, req, res, next) {
  console.error('API Error:', err);

  // Multer file size limit error
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File is too large. Maximum allowed size is 5 MB.',
      });
    }
    return res.status(400).json({
      success: false,
      message: `File upload error: ${err.message}`,
    });
  }

  // Custom file type error
  if (err.code === 'INVALID_FILE_TYPE') {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  // Status code from services or controllers
  const statusCode = err.statusCode || 500;
  const message = err.message || 'An unexpected server error occurred.';

  res.status(statusCode).json({
    success: false,
    message,
  });
}

module.exports = errorHandler;
