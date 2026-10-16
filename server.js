require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

// Import routes
const resumeRoutes = require('./routes/resumeRoutes');
const interviewRoutes = require('./routes/interviewRoutes');
const historyRoutes = require('./routes/historyRoutes');

// Import error handler
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend requests (Vite runs on port 5173 by default)
app.use(
  cors({
    origin: '*', // Allows requests from any origin in development
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static uploads folder (if needed for debugging)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    message: 'Resume Analyzer API is up and running!',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/resume', resumeRoutes);
app.use('/api/interview', interviewRoutes);
app.use('/api/history', historyRoutes);

// Central error handler
app.use(errorHandler);

// Connect to MongoDB Atlas and start server
async function startServer() {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri || mongoUri.includes('<username>')) {
    console.warn('\n======================================================');
    console.warn('⚠️  WARNING: MONGO_URI is not configured in server/.env');
    console.warn('   Please provide a valid MongoDB connection string.');
    console.warn('======================================================\n');
  }

  try {
    if (mongoUri && !mongoUri.includes('<username>')) {
      await mongoose.connect(mongoUri);
      console.log('✅ Connected to MongoDB Atlas successfully.');
    } else {
      console.log('ℹ️  Starting server without MongoDB. Note: Database operations will fail until MONGO_URI is set.');
    }
  } catch (err) {
    console.error('❌ MongoDB Connection Error:', err.message);
    console.warn('ℹ️  Server will still run, but database actions will fail until MongoDB is connected.');
  }

  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📡 Health check available at http://localhost:${PORT}/api/health`);
  });
}

startServer();
