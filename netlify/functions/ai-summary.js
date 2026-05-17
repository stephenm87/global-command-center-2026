// ai-summary.js - Gemini-powered geopolitical intelligence brief generator
// Accepts: POST { url, title, content } where content = Firecrawl markdown
// Returns: structured intelligence brief for IB Global Politics students
const { callGeminiWithRetry } = require('./gemini-retry');

// ── Rate limiter ───────────────────────────────────────────────────────────
const RATE_WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 20; // AI calls are expensive
const requestLog = [];

function isRateLimited() {
    const now = Date.now();
    while (requestLog.length && requestLog[0] < now - RATE_WINDOW_MS) requestLog.shift();
    if (requestLog.length >= MAX_REQUESTS) return true;
    requestLog.push(now);
    return false;
}

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const SYSTEM_PROMPT = `You are an IB Global Politics intelligence analyst. Your role is to transform raw news content into structured geopolitical intelligence briefs for high school students studying the IB Global Politics 2026 syllabus.

Given article content, produce a JSON response with exactly these fields:
{
  "oneLiner": "One-sentence BLUF (Bottom Line Up Front) — the most important takeaway in plain language",
  "keyActors": ["Array of 2-5 key state or non-state actors involved"],
  "ibThemes": ["Array of 1-3 relevant IB GP themes from: Power & Sovereignty, Human Rights, Development, Peace & Conflict, Global Governance, Identity, Technology"],
  "keyConceptTags": ["Array of 2-4 IB key concepts from: Power, Sovereignty, Legitimacy, Interdependence, Human Rights, Justice, Liberty, Equality, Development, Globalization, Peace, Conflict, Violence, Identity, Community, Sustainability"],
  "riskLevel": "HIGH or MEDIUM or LOW — assessed geopolitical risk level",
  "riskReason": "One sentence explaining why you chose that risk level",
  "cuiBono": "One sentence answering: Who benefits from this event or its current framing? Whose interests are served?",
  "globalSouthPerspective": "2-3 sentences presenting how this event would be viewed from the Global South — consider perspectives from Africa, Latin America, South/Southeast Asia, or the Middle East. How might their media frame this differently than Western outlets?",
  "historicalParallel": "One sentence suggesting a historical analogy (e.g., 'This echoes the 1962 Cuban Missile Crisis in its brinkmanship dynamics')",
  "sourceType": "Classify the source: State Media | Wire Service | Independent Media | Think Tank | NGO Report | Social Media | Academic",
  "sourceBias": "Brief note on potential bias or perspective of the source (e.g., 'Western-aligned think tank; may underrepresent Global South agency')",
  "studentPrompt": "One thought-provoking discussion question for IB students that encourages critical thinking",
  "paper2Prompts": {
    "identify": "A prompt asking students to identify the key issue and actors (SL level)",
    "explain": "A prompt asking students to explain the event using a specific IR theory (HL level)",
    "evaluate": "A prompt asking students to evaluate competing perspectives on this event (HL level)"
  },
  "rawSummary": "A concise 2-3 sentence analytical summary of the event and its geopolitical significance"
}

Rules:
- Be analytical, not sensationalist
- Use precise geopolitical terminology
- The globalSouthPerspective MUST present a genuinely different viewpoint, not just restate the Western framing in softer terms
- Keep all text appropriate for 16-18 year old students
- Only return valid JSON — no markdown, no code blocks, no extra text
- If content is insufficient, still return valid JSON with best-effort analysis`;

exports.handler = async (event) => {
    // Rate limit check
    if (event.httpMethod !== 'OPTIONS' && isRateLimited()) {
        return { statusCode: 429, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Rate limit exceeded. Try again in a few minutes.' }) };
    }

    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const { url, title, content } = JSON.parse(event.body || '{}');

        if (!content && !title) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Content or title required' })
            };
        }

        const geminiKey = process.env.GEMINI_API_KEY;
        if (!geminiKey) {
            return {
                statusCode: 503,
                headers,
                body: JSON.stringify({ error: 'AI Summary unavailable — Gemini not configured' })
            };
        }

        // Truncate content to avoid token limits (Gemini Flash: 1M context, but keep costs low)
        const maxContentLength = 4000;
        const truncatedContent = (content || '').substring(0, maxContentLength);

        const userMessage = `Article URL: ${url || 'Unknown'}
Article Title: ${title || 'Untitled'}

Article Content:
${truncatedContent}

Generate the intelligence brief JSON now.`;

        const geminiRes = await callGeminiWithRetry(`${GEMINI_API_BASE}?key=${geminiKey}`, {
            contents: [
                {
                    role: 'user',
                    parts: [{ text: SYSTEM_PROMPT + '\n\n' + userMessage }]
                }
            ],
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 1500,
                response_mime_type: 'application/json',
                // Disable thinking for structured JSON output — faster, cheaper, avoids
                // the thinking parts interfering with JSON parsing
                thinkingConfig: { thinkingBudget: 0 }
            }
        });

        if (!geminiRes.ok) {
            const errText = await geminiRes.text();
            throw new Error(`Gemini error ${geminiRes.status}: ${errText.substring(0, 200)}`);
        }

        const geminiData = await geminiRes.json();
        // gemini-2.5-flash is a thinking model: parts may contain { thought: true } entries.
        // Find the actual (non-thought) text part for JSON parsing.
        const parts = geminiData.candidates?.[0]?.content?.parts || [];
        const responsePart = parts.find(p => p.text && !p.thought) || parts.find(p => p.text) || {};
        const rawText = responsePart.text || '{}';

        // Parse the JSON response from Gemini
        let brief;
        try {
            brief = JSON.parse(rawText);
        } catch (parseErr) {
            // Attempt to extract JSON from response if it's wrapped in markdown
            const jsonMatch = rawText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                brief = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('Could not parse Gemini response as JSON');
            }
        }

        // Validate required fields and provide safe defaults
        const safeBrief = {
            oneLiner: brief.oneLiner || 'Analysis unavailable — insufficient article content.',
            keyActors: Array.isArray(brief.keyActors) ? brief.keyActors : [],
            ibThemes: Array.isArray(brief.ibThemes) ? brief.ibThemes : ['Power & Sovereignty'],
            riskLevel: ['HIGH', 'MEDIUM', 'LOW'].includes(brief.riskLevel) ? brief.riskLevel : 'MEDIUM',
            riskReason: brief.riskReason || '',
            studentPrompt: brief.studentPrompt || 'How does this event reflect the dynamics of power in the current global order?',
            rawSummary: brief.rawSummary || '',
            generatedAt: new Date().toISOString()
        };

        return { statusCode: 200, headers, body: JSON.stringify(safeBrief) };

    } catch (error) {
        console.error('[ai-summary] Error:', error.message);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'AI analysis temporarily unavailable. Please try again later.' })
        };
    }
};
