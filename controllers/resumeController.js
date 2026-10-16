const Resume = require('../models/Resume');
const { extractTextFromPdf } = require('../services/pdfService');
const { analyzeResume } = require('../services/claudeService');

/**
 * Handles PDF resume upload, extracts text, analyzes it with Claude,
 * saves analysis to MongoDB, and returns the score and breakdown.
 */
async function uploadAndAnalyzeResume(req, res, next) {
  try {
    // 1. Verify file was provided by multer
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No resume file uploaded. Please upload a PDF file.',
      });
    }

    // 2. Extract text from the PDF file
    const extractedText = await extractTextFromPdf(req.file.path);

    // 3. Send extracted text to Claude for analysis
    const analysis = await analyzeResume(extractedText);

    // 4. Save analysis in MongoDB
    const resumeDoc = new Resume({
      fileName: req.file.originalname,
      extractedText,
      scores: {
        overall: analysis.overall || 0,
        breakdown: {
          skills: analysis.breakdown?.skills || 0,
          experience: analysis.breakdown?.experience || 0,
          projects: analysis.breakdown?.projects || 0,
          education: analysis.breakdown?.education || 0,
          clarityFormatting: analysis.breakdown?.clarityFormatting || 0,
        },
      },
      strengths: Array.isArray(analysis.strengths) ? analysis.strengths : [],
      weaknesses: Array.isArray(analysis.weaknesses) ? analysis.weaknesses : [],
      suggestions: Array.isArray(analysis.suggestions) ? analysis.suggestions : [],
    });

    await resumeDoc.save();

    // 5. Respond with results and resumeId
    res.status(200).json({
      success: true,
      resumeId: resumeDoc._id,
      fileName: resumeDoc.fileName,
      scores: resumeDoc.scores,
      strengths: resumeDoc.strengths,
      weaknesses: resumeDoc.weaknesses,
      suggestions: resumeDoc.suggestions,
      createdAt: resumeDoc.createdAt,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  uploadAndAnalyzeResume,
};
