const mongoose = require('mongoose');

// Schema for storing analyzed resume data
const ResumeSchema = new mongoose.Schema(
  {
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    extractedText: {
      type: String,
      required: true,
    },
    scores: {
      overall: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
      },
      breakdown: {
        skills: { type: Number, default: 0, min: 0, max: 100 },
        experience: { type: Number, default: 0, min: 0, max: 100 },
        projects: { type: Number, default: 0, min: 0, max: 100 },
        education: { type: Number, default: 0, min: 0, max: 100 },
        clarityFormatting: { type: Number, default: 0, min: 0, max: 100 },
      },
    },
    strengths: {
      type: [String],
      default: [],
    },
    weaknesses: {
      type: [String],
      default: [],
    },
    suggestions: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true, // Automatically manages createdAt and updatedAt
  }
);

module.exports = mongoose.model('Resume', ResumeSchema);
