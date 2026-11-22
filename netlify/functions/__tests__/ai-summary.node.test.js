const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const { callGeminiWithRetry, _retryConfig } = require('../gemini-retry');

let modPromise;
function loadAiSummary() {
    if (!modPromise) {
        modPromise = import(pathToFileURL(path.resolve(__dirname, '../ai-summary.mjs')).href);
    }
    return modPromise;
}

function createMemoryStore(backing = new Map(), { throwOnGet = false, throwOnSet = false } = {}) {
    return {
        async get(key) {
            if (throwOnGet) throw new Error('Blobs get error');
            return backing.has(key) ? JSON.parse(JSON.stringify(backing.get(key))) : null;
        },
        async setJSON(key, value) {
            if (throwOnSet) throw new Error('Blobs set error');
            backing.set(key, JSON.parse(JSON.stringify(value)));
        },
    };
}

test('sanitizes and preserves every UI-facing intelligence field', async () => {
    const { _test } = await loadAiSummary();
    const brief = _test.sanitizeBrief({
        oneLiner: '  Bottom line  ',
        keyActors: ['Actor A', '', 'Actor B'],
        ibThemes: ['Power & Sovereignty'],
        keyConceptTags: ['Power', 'Legitimacy'],
        riskLevel: 'HIGH',
        riskReason: 'Escalation risk',
        cuiBono: 'Actor A benefits.',
        globalSouthPerspective: 'A distinct perspective.',
        historicalParallel: 'A historical comparison.',
        sourceType: 'Wire Service',
        sourceBias: 'Potential framing limitation.',
        studentPrompt: 'Who holds power?',
        paper2Prompts: { identify: 'Identify.', explain: 'Explain.', evaluate: 'Evaluate.' },
        rawSummary: 'Analysis.',
    });

    assert.equal(brief.schemaVersion, _test.BRIEF_SCHEMA_VERSION);
    assert.equal(brief.oneLiner, 'Bottom line');
    assert.deepEqual(brief.keyConceptTags, ['Power', 'Legitimacy']);
    assert.equal(brief.cuiBono, 'Actor A benefits.');
    assert.equal(brief.globalSouthPerspective, 'A distinct perspective.');
    assert.equal(brief.paper2Prompts.evaluate, 'Evaluate.');
    assert.ok(brief.generatedAt);
});

test('content selection preserves the lead and conclusion within the cost limit', async () => {
    const { _test } = await loadAiSummary();
    const content = `LEAD ${'a'.repeat(9000)} CONCLUSION ${'z'.repeat(9000)} END`;
    const selected = _test.selectArticleContent(content);

    assert.ok(selected.length <= _test.MAX_ARTICLE_CONTENT_LENGTH + 60);
    assert.match(selected, /^LEAD/);
    assert.match(selected, /END$/);
    assert.match(selected, /middle omitted/);
});

test('sanitizer supplies safe shapes for malformed model output', async () => {
    const { _test } = await loadAiSummary();
    const brief = _test.sanitizeBrief({
        keyActors: 'not-an-array',
        riskLevel: 'EXTREME',
        sourceType: 'Unknown',
    });

    assert.deepEqual(brief.keyActors, []);
    assert.equal(brief.riskLevel, 'MEDIUM');
    assert.equal(brief.sourceType, 'Independent Media');
    assert.deepEqual(brief.paper2Prompts, { identify: '', explain: '', evaluate: '' });
});

test('defaults to gemini-3.5-flash-lite with systemInstruction, minimal thinkingLevel, no temperature, and header auth', async () => {
    const { _test } = await loadAiSummary();
    assert.equal(_test.DEFAULT_GEMINI_MODEL, 'gemini-3.5-flash-lite');
    const req = _test.buildGeminiRequest('gemini-3.5-flash-lite', 'Sample user article', 'secret-test-key');

    assert.equal(
        req.url,
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent',
    );
    assert.ok(!req.url.includes('secret-test-key'), 'API key must not appear in URL query string');
    assert.equal(req.headers['x-goog-api-key'], 'secret-test-key');
    assert.ok(req.body.systemInstruction?.parts?.[0]?.text.includes('IB Global Politics'));
    assert.equal(req.body.contents.length, 1);
    assert.equal(req.body.contents[0].role, 'user');
    assert.equal(req.body.contents[0].parts[0].text, 'Sample user article');
    assert.equal('temperature' in req.body.generationConfig, false);
    assert.equal(req.body.generationConfig.maxOutputTokens, _test.MAX_OUTPUT_TOKENS);
    assert.deepEqual(req.body.generationConfig.thinkingConfig, { thinkingLevel: 'minimal' });

    const proReq = _test.buildGeminiRequest('gemini-3.1-pro-preview', 'Sample user article', 'secret-test-key');
    assert.equal('thinkingConfig' in proReq.body.generationConfig, false, 'Pro overrides should not receive minimal thinkingLevel');
    assert.equal(proReq.body.generationConfig.maxOutputTokens, _test.MAX_OUTPUT_TOKENS);
});

test('rejects safety-blocked, recitation, truncated MAX_TOKENS, and empty Gemini candidate payloads instead of returning 200 OK', async () => {
    const { _test } = await loadAiSummary();
    assert.throws(
        () => _test.extractCandidateJsonText({ promptFeedback: { blockReason: 'SAFETY' }, candidates: [] }),
        err => err.statusCode === 422 && /safety/i.test(err.message),
    );
    assert.throws(
        () => _test.extractCandidateJsonText({ candidates: [{ finishReason: 'RECITATION', content: { parts: [] } }] }),
        err => err.statusCode === 422,
    );
    assert.throws(
        () => _test.extractCandidateJsonText({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{"oneLiner":"cut' }] } }] }),
        err => err.statusCode === 502 && /truncated/i.test(err.message),
    );
    assert.throws(
        () => _test.extractCandidateJsonText({ candidates: [] }),
        err => err.statusCode === 502 && /empty/i.test(err.message),
    );
});

test('gemini-retry stays within synchronous gateway deadline (<22s) and preserves Content-Type with header auth', async () => {
    assert.ok(_retryConfig, '_retryConfig should be exported');
    const worstCaseMs = (_retryConfig.MAX_RETRIES + 1) * _retryConfig.REQUEST_TIMEOUT_MS
        + _retryConfig.MAX_RETRIES * _retryConfig.MAX_RETRY_DELAY_MS;
    assert.ok(worstCaseMs <= 22000, `Expected worst-case retry budget <= 22000ms, got ${worstCaseMs}ms`);
    assert.ok(_retryConfig.DEADLINE_MS <= 22000);

    const originalFetch = global.fetch;
    let capturedHeaders = null;
    global.fetch = async (_url, init) => {
        capturedHeaders = init.headers;
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };
    try {
        const res = await callGeminiWithRetry('https://example.googleapis.com/v1beta/models/test:generateContent', { contents: [] }, {
            headers: { 'x-goog-api-key': 'header-key' },
        });
        assert.equal(res.status, 200);
        assert.equal(capturedHeaders['Content-Type'], 'application/json');
        assert.equal(capturedHeaders['x-goog-api-key'], 'header-key');
    } finally {
        global.fetch = originalFetch;
    }
});

test('handleAiSummary enforces 64 KiB body limit, bounds prompt length & maxOutputTokens, enforces daily cap & fail-closed Blobs, and strips provider secrets/errors', async () => {
    const { handleAiSummary, _test } = await loadAiSummary();
    const originalFetch = global.fetch;
    const origError = console.error;
    const logged = [];
    console.error = (...args) => logged.push(args.join(' '));

    let geminiCalls = 0;
    let lastGeminiBody = null;
    const baseEnv = {
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
        GEMINI_API_KEY: 'super-secret-gemini-key',
        AI_SUMMARY_DAILY_CAP: '1',
    };

    try {
        global.fetch = async (url) => {
            if (String(url).includes('/auth/v1/user')) {
                return { ok: true, json: async () => ({ id: 'u-summary', email: 'student@school.edu' }) };
            }
            throw new Error(`Unexpected external fetch: ${url}`);
        };

        // 1. Oversized body (> 64 KiB) rejected with 413 before parsing or touching Gemini
        const oversizedReq = new Request('https://example.org/.netlify/functions/ai-summary', {
            method: 'POST',
            headers: { authorization: 'Bearer tok', 'content-type': 'application/json' },
            body: JSON.stringify({ content: 'x'.repeat(_test.MAX_BODY_BYTES + 1024) }),
        });
        const store = createMemoryStore();
        const r413 = await handleAiSummary(oversizedReq, null, {
            env: baseEnv,
            securityOptions: { store },
            callGeminiWithRetry: async () => {
                geminiCalls += 1;
                throw new Error('Should not be called');
            },
        });
        assert.equal(r413.status, 413);
        assert.equal(geminiCalls, 0);

        // 2. Long url/title/content clamped inside MAX_PROMPT_LENGTH with fixed maxOutputTokens
        const okReq = new Request('https://example.org/.netlify/functions/ai-summary', {
            method: 'POST',
            headers: { authorization: 'Bearer tok', 'content-type': 'application/json' },
            body: JSON.stringify({
                url: `https://example.org/${'p'.repeat(3000)}`,
                title: 'T'.repeat(800),
                content: 'Word '.repeat(3500),
            }),
        });
        const r200 = await handleAiSummary(okReq, null, {
            env: baseEnv,
            securityOptions: { store },
            callGeminiWithRetry: async (_url, body) => {
                geminiCalls += 1;
                lastGeminiBody = body;
                return new Response(JSON.stringify({
                    candidates: [{ content: { parts: [{ text: JSON.stringify({ oneLiner: 'Brief summary.' }) }] } }],
                }), { status: 200 });
            },
        });
        assert.equal(r200.status, 200);
        assert.equal(geminiCalls, 1);
        assert.ok(lastGeminiBody.contents[0].parts[0].text.length <= _test.MAX_PROMPT_LENGTH);
        assert.equal(lastGeminiBody.generationConfig.maxOutputTokens, _test.MAX_OUTPUT_TOKENS);

        // 3. Daily cap reached refuses next request with 429 and zero Gemini call
        const capReq = new Request('https://example.org/.netlify/functions/ai-summary', {
            method: 'POST',
            headers: { authorization: 'Bearer tok2', 'content-type': 'application/json' },
            body: JSON.stringify({ content: 'a'.repeat(250) }),
        });
        const r429 = await handleAiSummary(capReq, null, {
            env: baseEnv,
            securityOptions: { store },
            callGeminiWithRetry: async () => {
                geminiCalls += 1;
                throw new Error('Should not be called');
            },
        });
        assert.equal(r429.status, 429);
        assert.equal(geminiCalls, 1);

        // 4. Blobs failure fails closed with 503 and zero Gemini call
        const r503 = await handleAiSummary(
            new Request('https://example.org/.netlify/functions/ai-summary', {
                method: 'POST',
                headers: { authorization: 'Bearer tok', 'content-type': 'application/json' },
                body: JSON.stringify({ content: 'a'.repeat(250) }),
            }),
            null,
            {
                env: baseEnv,
                securityOptions: { store: createMemoryStore(new Map(), { throwOnGet: true }) },
                callGeminiWithRetry: async () => {
                    geminiCalls += 1;
                    throw new Error('Should not be called');
                },
            },
        );
        assert.equal(r503.status, 503);
        assert.equal(geminiCalls, 1);

        // 5. Upstream Gemini raw error body and API key never leak to client or logs
        const failStore = createMemoryStore();
        const r500 = await handleAiSummary(
            new Request('https://example.org/.netlify/functions/ai-summary', {
                method: 'POST',
                headers: { authorization: 'Bearer tok', 'content-type': 'application/json' },
                body: JSON.stringify({ content: 'a'.repeat(250) }),
            }),
            null,
            {
                env: { ...baseEnv, AI_SUMMARY_DAILY_CAP: '200' },
                securityOptions: { store: failStore },
                callGeminiWithRetry: async () => new Response('RAW_GEMINI_SECRET_BODY super-secret-gemini-key', { status: 403 }),
            },
        );
        assert.equal(r500.status, 500);
        const errBody = await r500.text();
        assert.ok(!errBody.includes('RAW_GEMINI_SECRET_BODY'));
        assert.ok(!errBody.includes('super-secret-gemini-key'));
        assert.ok(!logged.join('\n').includes('RAW_GEMINI_SECRET_BODY'));
        assert.ok(!logged.join('\n').includes('super-secret-gemini-key'));
    } finally {
        global.fetch = originalFetch;
        console.error = origError;
    }
});
