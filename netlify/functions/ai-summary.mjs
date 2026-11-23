// ai-summary.mjs - Gemini-powered geopolitical intelligence brief generator
// Accepts: POST { url, title, content } where content = Firecrawl markdown
// Returns: structured intelligence brief for IB Global Politics students
import retryModule from './gemini-retry.js';
import securityModule from './security.js';
import { RATE_LIMIT_BLOB_FACTORIES } from './_shared/rate-limit-store.mjs';

const { callGeminiWithRetry } = retryModule;
const { protectEndpoint, readEnv, toResponse } = securityModule;

const BRIEF_SCHEMA_VERSION = '1.0';
const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';
const MIN_ARTICLE_CONTENT_LENGTH = 200;
const MAX_ARTICLE_CONTENT_LENGTH = 12000;
const MAX_URL_LENGTH = 2048;
const MAX_TITLE_LENGTH = 300;
const MAX_PROMPT_LENGTH = 15000;
const MAX_OUTPUT_TOKENS = 1500;
const MAX_BODY_BYTES = 64 * 1024;
const DEFAULT_DAILY_CAP = 200;
const HANDLER_BUDGET_MS = 21500;
const BLOCKED_FINISH_REASONS = new Set(['SAFETY', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII', 'RECITATION']);

const SOURCE_TYPES = new Set([
    'State Media', 'Wire Service', 'Independent Media', 'Think Tank',
    'NGO Report', 'Social Media', 'Academic',
]);

function resolveGeminiModel(envModel = process.env.GEMINI_SUMMARY_MODEL) {
    return typeof envModel === 'string' && envModel.trim()
        ? envModel.trim()
        : DEFAULT_GEMINI_MODEL;
}

function cleanText(value, fallback = '') {
    return typeof value === 'string' ? value.trim() : fallback;
}

function cleanList(value, maxItems) {
    return Array.isArray(value)
        ? value.map(item => cleanText(item)).filter(Boolean).slice(0, maxItems)
        : [];
}

function selectArticleContent(content) {
    const normalized = cleanText(content).replace(/\n{3,}/g, '\n\n');
    if (normalized.length <= MAX_ARTICLE_CONTENT_LENGTH) return normalized;

    // Preserve both the article lead and conclusion instead of silently losing
    // all material after the first few paragraphs.
    const leadLength = Math.floor(MAX_ARTICLE_CONTENT_LENGTH * 0.7);
    const tailLength = MAX_ARTICLE_CONTENT_LENGTH - leadLength;
    return `${normalized.slice(0, leadLength)}\n\n[...middle omitted for cost control...]\n\n${normalized.slice(-tailLength)}`;
}

function sanitizeBrief(brief = {}, model = resolveGeminiModel()) {
    const riskLevel = ['HIGH', 'MEDIUM', 'LOW'].includes(brief.riskLevel)
        ? brief.riskLevel
        : 'MEDIUM';
    const sourceType = SOURCE_TYPES.has(brief.sourceType) ? brief.sourceType : 'Independent Media';

    return {
        schemaVersion: BRIEF_SCHEMA_VERSION,
        model,
        oneLiner: cleanText(brief.oneLiner, 'Analysis unavailable — insufficient article content.'),
        keyActors: cleanList(brief.keyActors, 5),
        ibThemes: cleanList(brief.ibThemes, 3),
        keyConceptTags: cleanList(brief.keyConceptTags, 4),
        riskLevel,
        riskReason: cleanText(brief.riskReason),
        cuiBono: cleanText(brief.cuiBono),
        globalSouthPerspective: cleanText(brief.globalSouthPerspective),
        historicalParallel: cleanText(brief.historicalParallel),
        sourceType,
        sourceBias: cleanText(brief.sourceBias),
        studentPrompt: cleanText(brief.studentPrompt, 'How does this event reflect the dynamics of power in the current global order?'),
        paper2Prompts: {
            identify: cleanText(brief.paper2Prompts?.identify),
            explain: cleanText(brief.paper2Prompts?.explain),
            evaluate: cleanText(brief.paper2Prompts?.evaluate),
        },
        rawSummary: cleanText(brief.rawSummary),
        generatedAt: new Date().toISOString(),
    };
}

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

function buildGenerationConfig(model) {
    if (/^gemini-2\.5\b/i.test(model)) {
        return {
            temperature: 0.3,
            maxOutputTokens: MAX_OUTPUT_TOKENS,
            responseMimeType: 'application/json',
            ...(/pro/i.test(model) ? {} : { thinkingConfig: { thinkingBudget: 0 } }),
        };
    }

    // Gemini 3.5 Flash-Lite and Flash models deprecate sampling parameters (temperature)
    // and configure reasoning effort via thinkingLevel: 'minimal'; Pro overrides omit minimal.
    return {
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        responseMimeType: 'application/json',
        ...(/pro/i.test(model) ? {} : { thinkingConfig: { thinkingLevel: 'minimal' } }),
    };
}

function buildUserMessage({ url, title, articleContent }) {
    const safeUrl = cleanText(url, 'Unknown').slice(0, MAX_URL_LENGTH) || 'Unknown';
    const safeTitle = cleanText(title, 'Untitled').slice(0, MAX_TITLE_LENGTH) || 'Untitled';
    const prefix = `Article URL: ${safeUrl}\nArticle Title: ${safeTitle}\n\nArticle Content:\n`;
    const suffix = '\n\nGenerate the intelligence brief JSON now.';
    const maxContentBudget = Math.max(0, MAX_PROMPT_LENGTH - prefix.length - suffix.length);
    const boundedContent = articleContent.length > maxContentBudget
        ? articleContent.slice(0, maxContentBudget)
        : articleContent;
    return `${prefix}${boundedContent}${suffix}`;
}

function buildGeminiRequest(model, userMessage, geminiKey) {
    const resolvedModel = resolveGeminiModel(model);
    return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(resolvedModel)}:generateContent`,
        headers: {
            'x-goog-api-key': geminiKey,
        },
        body: {
            systemInstruction: {
                parts: [{ text: SYSTEM_PROMPT }],
            },
            contents: [
                {
                    role: 'user',
                    parts: [{ text: userMessage }],
                },
            ],
            generationConfig: buildGenerationConfig(resolvedModel),
        },
    };
}

function extractCandidateJsonText(geminiData) {
    const blockReason = geminiData?.promptFeedback?.blockReason;
    const finishReason = geminiData?.candidates?.[0]?.finishReason;
    if (blockReason || BLOCKED_FINISH_REASONS.has(finishReason)) {
        const err = new Error(`Gemini blocked response due to safety or policy (${blockReason || finishReason})`);
        err.statusCode = 422;
        throw err;
    }

    const parts = geminiData?.candidates?.[0]?.content?.parts || [];
    const responsePart = parts.find(p => typeof p?.text === 'string' && p.text.trim() && !p.thought)
        || parts.find(p => typeof p?.text === 'string' && p.text.trim());

    if (!responsePart) {
        const err = new Error('Empty candidate response from Gemini');
        err.statusCode = 502;
        throw err;
    }

    if (finishReason === 'MAX_TOKENS') {
        const err = new Error('Gemini output was truncated at MAX_TOKENS');
        err.statusCode = 502;
        throw err;
    }

    return responsePart.text;
}

function jsonResponse(status, headers, payload) {
    return new Response(JSON.stringify(payload), { status, headers });
}

export async function handleAiSummary(request, context = null, deps = {}) {
    const startedAt = Date.now();
    const env = deps.env || process.env;
    const security = await protectEndpoint(request, {
        maxRequests: 12,
        scope: 'ai-summary',
        context,
        dailyCapEnv: 'AI_SUMMARY_DAILY_CAP',
        defaultDailyCap: DEFAULT_DAILY_CAP,
        maxBodyBytes: MAX_BODY_BYTES,
        env,
        ...RATE_LIMIT_BLOB_FACTORIES,
        ...(deps.securityOptions || {}),
    });
    if (security.response) return toResponse(security.response);

    const headers = security.headers;

    try {
        let payload;
        try {
            payload = JSON.parse(security.rawBody || '{}');
        } catch {
            return jsonResponse(400, headers, { error: 'Invalid JSON request body.' });
        }
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            return jsonResponse(400, headers, { error: 'Request body must be a JSON object.' });
        }

        const { url, title, content } = payload;

        const articleContent = selectArticleContent(content);
        if (articleContent.length < MIN_ARTICLE_CONTENT_LENGTH) {
            return jsonResponse(400, headers, {
                error: `At least ${MIN_ARTICLE_CONTENT_LENGTH} characters of article content are required for a reliable brief.`,
            });
        }

        const geminiKey = readEnv('GEMINI_API_KEY', env);
        if (!geminiKey) {
            return jsonResponse(503, headers, { error: 'AI Summary unavailable — Gemini not configured' });
        }

        const activeModel = resolveGeminiModel(readEnv('GEMINI_SUMMARY_MODEL', env));
        const userMessage = buildUserMessage({ url, title, articleContent });

        const reqSpec = buildGeminiRequest(activeModel, userMessage, geminiKey);
        const remainingMs = Math.max(2500, HANDLER_BUDGET_MS - (Date.now() - startedAt));
        const callGemini = deps.callGeminiWithRetry || callGeminiWithRetry;
        const geminiRes = await callGemini(reqSpec.url, reqSpec.body, {
            headers: reqSpec.headers,
            deadlineAt: startedAt + HANDLER_BUDGET_MS,
            deadlineMs: remainingMs,
        });

        if (!geminiRes.ok) {
            throw new Error(`Gemini upstream error (${geminiRes.status})`);
        }

        const geminiData = await geminiRes.json();
        const rawText = extractCandidateJsonText(geminiData);

        let brief;
        try {
            brief = JSON.parse(rawText);
        } catch {
            const jsonMatch = rawText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                brief = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('Could not parse Gemini response as JSON');
            }
        }

        const safeBrief = sanitizeBrief(brief, activeModel);
        return jsonResponse(200, headers, safeBrief);
    } catch (error) {
        const safeLabel = error?.statusCode === 422 || error?.statusCode === 502 || /^Gemini upstream error/.test(error?.message || '')
            ? error.message
            : (error?.name || 'Error');
        console.error(`[ai-summary] Error (${error?.statusCode || 500}):`, safeLabel);
        if (error.statusCode === 422) {
            return jsonResponse(422, headers, {
                error: 'AI summary unavailable because article content triggered safety filters.',
            });
        }
        if (error.statusCode === 502) {
            return jsonResponse(502, headers, {
                error: 'AI analysis returned an empty response. Please try again.',
            });
        }
        return jsonResponse(500, headers, {
            error: 'AI analysis temporarily unavailable. Please try again later.',
        });
    }
}

export default async (request, context) => handleAiSummary(request, context);

export const _test = {
    BRIEF_SCHEMA_VERSION,
    DEFAULT_GEMINI_MODEL,
    MIN_ARTICLE_CONTENT_LENGTH,
    MAX_ARTICLE_CONTENT_LENGTH,
    MAX_URL_LENGTH,
    MAX_TITLE_LENGTH,
    MAX_PROMPT_LENGTH,
    MAX_OUTPUT_TOKENS,
    MAX_BODY_BYTES,
    DEFAULT_DAILY_CAP,
    resolveGeminiModel,
    buildUserMessage,
    buildGenerationConfig,
    buildGeminiRequest,
    extractCandidateJsonText,
    sanitizeBrief,
    selectArticleContent,
};
