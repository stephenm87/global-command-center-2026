// ai-summary.js - Gemini-powered geopolitical intelligence brief generator
// Accepts: POST { url, title, content } where content = Firecrawl markdown
// Returns: structured intelligence brief for IB Global Politics students

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const SYSTEM_PROMPT = `You are an IB Global Politics intelligence analyst. Your role is to transform raw news content into structured geopolitical intelligence briefs for high school students studying the IB Global Politics 2026 syllabus.

Given article content, produce a JSON response with exactly these fields:
{
  "oneLiner": "One-sentence BLUF (Bottom Line Up Front) — the most important takeaway in plain language",
  "keyActors": ["Array of 2-5 key state or non-state actors involved"],
  "ibThemes": ["Array of 1-3 relevant IB GP themes from: Power & Sovereignty, Human Rights, Development, Peace & Conflict, Global Governance, Identity, Technology"],
  "riskLevel": "HIGH or MEDIUM or LOW — assessed geopolitical risk level",
  "riskReason": "One sentence explaining why you chose that risk level",
  "studentPrompt": "One thought-provoking discussion question for IB students that encourages critical thinking",
  "rawSummary": "A concise 2-3 sentence analytical summary of the event and its geopolitical significance"
}

Rules:
- Be analytical, not sensationalist
- Use precise geopolitical terminology
- Keep all text appropriate for 16-18 year old students
- Only return valid JSON — no markdown, no code blocks, no extra text
- If content is insufficient, still return valid JSON with best-effort analysis`;

exports.handler = async (event) => {
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

        const geminiRes = await fetch(`${GEMINI_API_BASE}?key=${geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [
                    {
                        role: 'user',
                        parts: [{ text: SYSTEM_PROMPT + '\n\n' + userMessage }]
                    }
                ],
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 800,
                    responseMimeType: 'application/json'
                }
            })
        });

        if (!geminiRes.ok) {
            const errText = await geminiRes.text();
            throw new Error(`Gemini error ${geminiRes.status}: ${errText.substring(0, 200)}`);
        }

        const geminiData = await geminiRes.json();
        const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

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
            body: JSON.stringify({ error: `AI analysis failed: ${error.message}` })
        };
    }
};
