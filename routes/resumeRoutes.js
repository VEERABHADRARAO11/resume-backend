const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { uploadAndAnalyzeResume } = require('../controllers/resumeController');


// POST /api/resume/upload - Upload PDF, extract text, analyze with Claude, save to MongoDB
router.post('/upload', upload.single('resume'), uploadAndAnalyzeResume);

module.exports = router;
