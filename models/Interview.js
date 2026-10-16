const mongoose = require('mongoose');

// Schema for each question in the interview
const QuestionSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true },
    category: { type: String, required: true }, // e.g., 'Languages/Tech', 'Projects', 'Experience/Education', 'HR'
    question: { type: String, required: true },
  },
  { _id: false }
);

// Schema for user's answer and AI evaluation
const AnswerSchema = new mongoose.Schema(
  {
    questionId: { type: Number, required: true },
    question: { type: String, required: true },
    userAnswer: { type: String, default: '' },
    score: { type: Number, min: 0, max: 10, default: 0 },
    feedback: { type: String, default: '' },
    sampleAnswer: { type: String, default: '' },
  },
  { _id: false }
);

// Schema for the entire interview session
const InterviewSchema = new mongoose.Schema(
  {
    resumeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Resume',
      required: true,
    },
    questions: [QuestionSchema],
    answers: [AnswerSchema],
    finalScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    overallSummary: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['in-progress', 'completed'],
      default: 'in-progress',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Interview', InterviewSchema);
