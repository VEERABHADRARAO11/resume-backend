const Interview = require('../models/Interview');
const Resume = require('../models/Resume');
const { generateQuestions, evaluateAnswers } = require('../services/claudeService');

/**
 * Starts a new interview session by generating 10 tailored questions based on resume content.
 */
async function startInterview(req, res, next) {
  try {
    const { resumeId } = req.body;
    if (!resumeId) {
      return res.status(400).json({
        success: false,
        message: 'resumeId is required to start an interview.',
      });
    }

    // Retrieve resume from database
    const resume = await Resume.findById(resumeId);
    if (!resume) {
      return res.status(404).json({
        success: false,
        message: 'Resume not found for the given resumeId.',
      });
    }

    // Generate 10 resume-specific questions with Claude
    const questions = await generateQuestions(resume.extractedText);

    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error('Failed to generate interview questions. Please try again.');
    }

    // Create interview record in database
    const interview = new Interview({
      resumeId: resume._id,
      questions: questions.map((q, index) => ({
        id: q.id || index + 1,
        category: q.category || 'General',
        question: q.question,
      })),
      answers: [],
      status: 'in-progress',
    });

    await interview.save();

    res.status(200).json({
      success: true,
      interviewId: interview._id,
      questions: interview.questions,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Evaluates candidate's answers, calculates scores, provides feedback, and saves results.
 */
async function submitInterview(req, res, next) {
  try {
    const { interviewId, answers } = req.body;
    if (!interviewId) {
      return res.status(400).json({
        success: false,
        message: 'interviewId is required to submit interview answers.',
      });
    }

    const interview = await Interview.findById(interviewId);
    if (!interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview session not found.',
      });
    }

    // Map each question to the provided answer (or empty string if skipped)
    const answersMap = new Map();
    if (Array.isArray(answers)) {
      answers.forEach((ans) => {
        answersMap.set(Number(ans.questionId), (ans.userAnswer || '').trim());
      });
    }

    const questionsWithAnswers = interview.questions.map((q) => ({
      questionId: q.id,
      category: q.category,
      question: q.question,
      userAnswer: answersMap.get(q.id) || '',
    }));

    // Evaluate all answers using Claude
    const evaluation = await evaluateAnswers(questionsWithAnswers);

    // Merge evaluations into answer documents
    const evalMap = new Map();
    if (Array.isArray(evaluation.evaluations)) {
      evaluation.evaluations.forEach((item) => {
        evalMap.set(Number(item.questionId), item);
      });
    }

    const evaluatedAnswers = questionsWithAnswers.map((qa) => {
      const evalItem = evalMap.get(qa.questionId) || {};
      return {
        questionId: qa.questionId,
        question: qa.question,
        userAnswer: qa.userAnswer,
        score: typeof evalItem.score === 'number' ? evalItem.score : 0,
        feedback: evalItem.feedback || 'Answer evaluated.',
        sampleAnswer: evalItem.sampleAnswer || 'A strong answer would address the question clearly with real examples.',
      };
    });

    interview.answers = evaluatedAnswers;
    interview.finalScore = typeof evaluation.finalScore === 'number' ? evaluation.finalScore : 0;
    interview.overallSummary = evaluation.overallSummary || 'Interview completed.';
    interview.status = 'completed';

    await interview.save();

    res.status(200).json({
      success: true,
      interviewId: interview._id,
      finalScore: interview.finalScore,
      overallSummary: interview.overallSummary,
      answers: interview.answers,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  startInterview,
  submitInterview,
};
