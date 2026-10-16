const express = require('express');
const router = express.Router();
const { getHistory } = require('../controllers/historyController');

// GET /api/history - Retrieve all past resume analyses and interview sessions
router.get('/', getHistory);

module.exports = router;
