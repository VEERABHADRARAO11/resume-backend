const Resume = require('../models/Resume');
const Interview = require('../models/Interview');

/**
 * Returns a list of past resume analyses and interview sessions.
 */
async function getHistory(req, res, next) {
  try {
    // 1. Fetch all interview sessions with populated resume details
    const interviews = await Interview.find()
      .populate('resumeId', 'fileName scores strengths weaknesses suggestions createdAt')
      .sort({ createdAt: -1 })
      .lean();

    // 2. Fetch all resumes (including those without completed interviews)
    const resumes = await Resume.find()
      .sort({ createdAt: -1 })
      .lean();

    // Build unified history sessions
    const sessions = interviews.map((item) => ({
      interviewId: item._id,
      resumeId: item.resumeId ? item.resumeId._id : null,
      fileName: item.resumeId ? item.resumeId.fileName : 'Resume',
      date: item.createdAt,
      resumeScore: item.resumeId?.scores?.overall ?? null,
      resumeBreakdown: item.resumeId?.scores?.breakdown ?? null,
      interviewScore: item.finalScore,
      overallSummary: item.overallSummary,
      status: item.status,
      answers: item.answers || [],
    }));

    res.status(200).json({
      success: true,
      count: sessions.length,
      sessions,
      resumes,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getHistory,
};
