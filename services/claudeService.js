const { GoogleGenerativeAI } = require('@google/generative-ai');
const Anthropic = require('@anthropic-ai/sdk');

/**
 * Safely parses JSON string, handling possible markdown code blocks.
 */
function safeParseJson(rawText) {
  if (!rawText) return null;
  let text = rawText.trim();

  // Strip markdown code fences if model wrapped response in ```json ... ```
  if (text.startsWith('```json')) {
    text = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '');
  } else if (text.startsWith('```')) {
    text = text.replace(/^```\s*/, '').replace(/```\s*$/, '');
  }

  // Find first { or [ and last } or ]
  const firstBrace = text.indexOf('{');
  const firstBracket = text.indexOf('[');
  let startIdx = -1;
  let endIdx = -1;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    endIdx = text.lastIndexOf('}');
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    endIdx = text.lastIndexOf(']');
  }

  if (startIdx !== -1 && endIdx !== -1 && endIdx >= startIdx) {
    text = text.substring(startIdx, endIdx + 1);
  }

  return JSON.parse(text);
}

/**
 * Get configured API Key (checks GEMINI_API_KEY, ANTHROPIC_API_KEY)
 */
function getApiKey() {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    ''
  ).trim();
}

/**
 * Detect AI Provider based on API Key prefix
 */
function isGeminiKey(apiKey) {
  // Google API keys start with AQ. or AIzaSy or if GEMINI_API_KEY is explicitly defined
  return (
    apiKey.startsWith('AQ.') ||
    apiKey.startsWith('AIza') ||
    Boolean(process.env.GEMINI_API_KEY)
  );
}

/**
 * Execute prompt with Google Gemini using JSON output mode and smart model fallback
 */
async function callGeminiForJson(systemPrompt, userPrompt) {
  const apiKey = getApiKey();
  if (!apiKey || apiKey === 'your_anthropic_api_key_here' || apiKey === 'your_gemini_api_key_here') {
    const error = new Error('No valid API Key found in server/.env. Please configure GEMINI_API_KEY.');
    error.statusCode = 500;
    throw error;
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  // Preferred models with automatic resilience fallback
  const preferredModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const modelCandidates = [
    preferredModel,
    'gemini-3.5-flash-lite',
    'gemini-3.6-flash',
    'gemini-3.7-flash',
    'gemini-3.5-flash',
    'gemini-3.8-flash',
  ];

  // Remove duplicates
  const uniqueModels = [...new Set(modelCandidates)];

  let lastError = null;

  for (const modelName of uniqueModels) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: `${systemPrompt}\n\nIMPORTANT: Return ONLY valid, parseable JSON. Do not include markdown code blocks or explanations outside the JSON.`,
        generationConfig: {
          responseMimeType: 'application/json',
        },
      });

      const response = await model.generateContent(userPrompt);
      const text = response.response.text();
      return safeParseJson(text);
    } catch (err) {
      console.warn(`Attempt with model ${modelName} failed: ${err.message}`);
      lastError = err;
      // If 503 or 404, try next candidate in list
      continue;
    }
  }

  throw lastError || new Error('Failed to generate response with Gemini AI.');
}

/**
 * Execute prompt with Anthropic Claude (if using an Anthropic key)
 */
async function callClaudeForJson(systemPrompt, userPrompt, maxTokens = 3000) {
  const apiKey = getApiKey();
  const anthropic = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest';

  const messages = [{ role: 'user', content: userPrompt }];

  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      system: `${systemPrompt}\n\nIMPORTANT: Return ONLY raw, valid JSON.`,
      messages,
    });

    const contentText = response.content?.[0]?.text || '';
    return safeParseJson(contentText);
  } catch (err) {
    // Retry once
    const retry = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      system: `${systemPrompt}\n\nIMPORTANT: Return ONLY valid JSON.`,
      messages: [
        { role: 'user', content: userPrompt },
        { role: 'user', content: 'Your previous response was not valid JSON. Please reply with only strictly valid JSON.' },
      ],
    });
    return safeParseJson(retry.content?.[0]?.text || '');
  }
}

/**
 * Router that automatically invokes either Gemini or Claude
 */
async function callAiForJson(systemPrompt, userPrompt) {
  const apiKey = getApiKey();
  if (isGeminiKey(apiKey)) {
    return await callGeminiForJson(systemPrompt, userPrompt);
  }
  return await callClaudeForJson(systemPrompt, userPrompt);
}

/**
 * Analyzes resume text and generates overall score, breakdown, strengths, weaknesses, and suggestions.
 */
async function analyzeResume(resumeText) {
  const systemPrompt = `You are an expert technical recruiter and resume analyzer. Evaluate the candidate's resume objectively and provide actionable feedback.`;

  const userPrompt = `Please analyze the following resume text:

--- RESUME TEXT ---
${resumeText}
--- END RESUME TEXT ---

Evaluate this resume and return a JSON object with this EXACT structure:
{
  "overall": <number 0-100 representing overall quality>,
  "breakdown": {
    "skills": <number 0-100>,
    "experience": <number 0-100>,
    "projects": <number 0-100>,
    "education": <number 0-100>,
    "clarityFormatting": <number 0-100>
  },
  "strengths": [
    "<3 to 5 clear, specific strengths found in this resume>"
  ],
  "weaknesses": [
    "<3 to 5 clear, honest weaknesses or gaps in this resume>"
  ],
  "suggestions": [
    "<3 to 5 high-impact, specific recommendations to improve this resume>"
  ]
}

Ensure there are between 3 and 5 items in strengths, weaknesses, and suggestions. Return ONLY valid JSON.`;

  return await callAiForJson(systemPrompt, userPrompt);
}

/**
 * Generates exactly 10 interview questions with progressive difficulty:
 * Q1-Q2: Core Basics & Fundamentals of listed skills (NOT high-level)
 * Q3-Q4: Practical / Intermediate application of tools
 * Q5-Q7: Project-specific implementations (directly referencing their resume projects)
 * Q8-Q9: Experience, Problem Solving & Challenges
 * Q10: HR & Introduction
 */
async function generateQuestions(resumeText) {
  const systemPrompt = `You are a supportive, experienced technical interviewer conducting a mock interview.
Follow a structured, progressive interview flow: start from core fundamentals/basics of the candidate's listed skills, then move into their projects, then practical problem-solving, and finally a friendly HR question.
DO NOT jump directly into high-level system design or complex architectural questions. Keep the questions grounded, clear, and relevant to the candidate's resume level.`;

  const userPrompt = `Here is the candidate's resume text:

--- RESUME TEXT ---
${resumeText}
--- END RESUME TEXT ---

Generate exactly 10 interview questions following this PROGRESSIVE order (Easy/Basic -> Projects -> Practical -> HR):

1. [Q1 - Core Basics & Fundamentals]: A fundamental concept or definition question on the primary programming language or technology listed in the resume (e.g., basic concepts of JavaScript, Python, Java, SQL, or React basics).
2. [Q2 - Core Basics & Fundamentals]: Another straightforward question on foundational concepts (e.g., data types, functions, basic OOP, or core library principles mentioned in their skills).
3. [Q3 - Practical Application]: A practical question on how they use these technologies in real code (e.g., making API requests, managing state, handling forms, or querying a database).
4. [Q4 - Practical Application]: A question about best practices or common techniques in their listed tech stack (e.g., error handling, component reusability, asynchronous programming).
5. [Q5 - Resume Projects]: Direct question about the primary project listed on their resume (ask about its purpose, what features they built, and their individual contribution).
6. [Q6 - Resume Projects]: A technical question about the architecture or libraries used in their project (ask how a specific feature was implemented).
7. [Q7 - Resume Projects]: A question about a specific challenge, bug, or performance issue they encountered while building their project and how they solved it.
8. [Q8 - Experience & Problem Solving]: A question about their internship, training, or how they approach learning a new tool or debugging an unfamiliar error.
9. [Q9 - Experience & Problem Solving]: A situational/technical question (e.g., how they test their code or ensure code quality before pushing to GitHub).
10. [Q10 - HR & Behavioral]: A friendly, conversational question (e.g., "Tell us about yourself and what inspired you to build the projects on your resume?" or "How do you handle deadlines and team collaboration?").

RULES:
- Every question MUST be specific to the skills and projects mentioned in this candidate's resume.
- Do NOT ask intimidating or high-level abstract system design questions. Keep them practical and accessible.
- Return ONLY a JSON array with exactly 10 objects:

[
  { "id": 1, "category": "Core Basics & Fundamentals", "question": "<Question 1>" },
  { "id": 2, "category": "Core Basics & Fundamentals", "question": "<Question 2>" },
  { "id": 3, "category": "Practical Application", "question": "<Question 3>" },
  { "id": 4, "category": "Practical Application", "question": "<Question 4>" },
  { "id": 5, "category": "Resume Projects", "question": "<Question 5>" },
  { "id": 6, "category": "Resume Projects", "question": "<Question 6>" },
  { "id": 7, "category": "Resume Projects", "question": "<Question 7>" },
  { "id": 8, "category": "Experience & Problem Solving", "question": "<Question 8>" },
  { "id": 9, "category": "Experience & Problem Solving", "question": "<Question 9>" },
  { "id": 10, "category": "HR & Behavioral", "question": "<Question 10>" }
]`;

  return await callAiForJson(systemPrompt, userPrompt);
}

/**
 * Evaluates the candidate's answers to all 10 questions.
 * Returns score (0-10), feedback, and better sample answer for each, plus final score (0-100) and summary.
 */
async function evaluateAnswers(questionsWithAnswers) {
  const systemPrompt = `You are an expert interview coach and hiring manager. Evaluate the candidate's answers fairly and constructively. If an answer was skipped or blank, score it 0 and provide a great sample answer.`;

  const qaListText = questionsWithAnswers
    .map(
      (item, idx) => `Question ${idx + 1} [Category: ${item.category}]:
Question: "${item.question}"
Candidate Answer: "${item.userAnswer && item.userAnswer.trim() ? item.userAnswer.trim() : '[SKIPPED / NO ANSWER]'}"`
    )
    .join('\n\n');

  const userPrompt = `Here are the candidate's interview questions and answers:

${qaListText}

Please evaluate each answer.
For each question:
- Assign a score from 0 to 10 (0 if skipped or completely off-topic).
- Provide concise, constructive feedback (2-3 sentences explaining what was good and what was missing).
- Provide a clear, impressive sample answer that demonstrates how a strong candidate would answer.

Also calculate:
- "finalScore": an overall interview score from 0 to 100 representing candidate readiness.
- "overallSummary": a 3-5 sentence overall performance review with advice for upcoming interviews.

Return a JSON object with this EXACT structure:
{
  "finalScore": <number 0-100>,
  "overallSummary": "<overall assessment summary>",
  "evaluations": [
    {
      "questionId": <number matching the question id 1 to 10>,
      "score": <number 0-10>,
      "feedback": "<concise feedback>",
      "sampleAnswer": "<better sample answer>"
    }
  ]
}

Return ONLY valid JSON.`;

  return await callAiForJson(systemPrompt, userPrompt);
}

module.exports = {
  analyzeResume,
  generateQuestions,
  evaluateAnswers,
};
