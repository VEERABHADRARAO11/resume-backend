const express = require('express');
const router = express.Router();
const { startInterview, submitInterview } = require('../controllers/interviewController');

// POST /api/interview/start - Generate 10 customized interview questions from resume
router.post('/start', startInterview);

// POST /api/interview/submit - Evaluate answers, compute final score, and save feedback
router.post('/submit', submitInterview);

module.exports = router;
