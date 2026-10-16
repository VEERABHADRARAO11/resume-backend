const fs = require('fs');
const pdfParse = require('pdf-parse');

/**
 * Extracts raw text from an uploaded PDF file buffer or path.
 * Ignores all images, photos, logos, and styling.
 * @param {string} filePath - Absolute or relative path to the uploaded PDF
 * @returns {Promise<string>} Cleaned extracted text
 */
async function extractTextFromPdf(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    
    // Parse the PDF buffer to extract textual content only
    const data = await pdfParse(dataBuffer);
    const extractedText = (data && data.text) ? data.text.trim() : '';

    // Check if readable text is minimal or absent (e.g. scanned image/blank PDF)
    if (!extractedText || extractedText.length < 50) {
      const error = new Error('This PDF has no readable text. Please upload a text-based PDF.');
      error.statusCode = 400;
      throw error;
    }

    return extractedText;
  } catch (err) {
    if (err.statusCode) throw err;
    const parseError = new Error(
      err.message.includes('readable text')
        ? err.message
        : 'Failed to extract text from PDF. Please make sure the file is a valid, readable PDF.'
    );
    parseError.statusCode = 400;
    throw parseError;
  }
}

module.exports = {
  extractTextFromPdf,
};
