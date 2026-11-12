const { AppError } = require('../middleware/error.middleware');

// The one place that talks to Google Gemini (key from https://aistudio.google.com/apikey)
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const TIMEOUT_MS = 30000;
const RETRY_STATUSES = new Set([429, 500, 503]); // briefly busy or overloaded: worth one more try
const RETRY_DELAY_MS = 1200;

/**
 * One Gemini turn. `contents` is the conversation in Gemini's format, `tools` optional function declarations.
 * Returns the model's content ({ role: 'model', parts }), which may hold text and/or functionCall parts.
 */
async function generate({ system, contents, tools, temperature = 0.5, maxOutputTokens = 1024 }) {
  if (!process.env.GEMINI_API_KEY) throw new AppError(503, 'The assistant is not configured');
  const model = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents,
    ...(tools && { tools: [{ functionDeclarations: tools }] }),
    generationConfig: { temperature, maxOutputTokens }
  });
  let response;
  for (let attempt = 1; ; attempt++) {
    try {
      response = await fetch(`${GEMINI_URL}/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS)
      });
    } catch (err) {
      if (err.name === 'TimeoutError') throw new AppError(504, 'The assistant took too long to answer. Please try again.');
      // A dropped connection: one more try, then a friendly message instead of a raw network error
      console.error('Gemini request failed:', err.cause?.code || err.message);
      if (attempt === 2) throw new AppError(502, 'The assistant is unavailable right now. Please try again later.');
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      continue;
    }
    if (attempt === 2 || !RETRY_STATUSES.has(response.status)) break;
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
  }

  if (response.status === 429) throw new AppError(429, 'The assistant is busy. Please try again in a moment.');
  if (!response.ok) {
    console.error('Gemini API error:', response.status, (await response.text()).slice(0, 300));
    throw new AppError(502, 'The assistant is unavailable right now. Please try again later.');
  }
  const data = await response.json();
  return data.candidates?.[0]?.content || { role: 'model', parts: [] };
}

// The text parts of a model reply
const textOf = (content) => (content.parts || []).map(p => p.text).filter(Boolean).join('').trim();

module.exports = { generate, textOf };
