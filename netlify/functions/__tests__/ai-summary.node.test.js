const test = require('node:test');
const assert = require('node:assert/strict');

const aiSummary = require('../ai-summary');
const { callGeminiWithRetry, _retryConfig } = require('../gemini-retry');
const { _test } = aiSummary;

test('sanitizes and preserves every UI-facing intelligence field', () => {
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
        rawSummary: 'Analysis.'
    });

    assert.equal(brief.schemaVersion, _test.BRIEF_SCHEMA_VERSION);
    assert.equal(brief.oneLiner, 'Bottom line');
    assert.deepEqual(brief.keyConceptTags, ['Power', 'Legitimacy']);
    assert.equal(brief.cuiBono, 'Actor A benefits.');
    assert.equal(brief.globalSouthPerspective, 'A distinct perspective.');
    assert.equal(brief.paper2Prompts.evaluate, 'Evaluate.');
    assert.ok(brief.generatedAt);
});

test('content selection preserves the lead and conclusion within the cost limit', () => {
    const content = `LEAD ${'a'.repeat(9000)} CONCLUSION ${'z'.repeat(9000)} END`;
    const selected = _test.selectArticleContent(content);

    assert.ok(selected.length <= _test.MAX_ARTICLE_CONTENT_LENGTH + 60);
    assert.match(selected, /^LEAD/);
    assert.match(selected, /END$/);
    assert.match(selected, /middle omitted/);
});

test('sanitizer supplies safe shapes for malformed model output', () => {
    const brief = _test.sanitizeBrief({
        keyActors: 'not-an-array',
        riskLevel: 'EXTREME',
        sourceType: 'Unknown'
    });

    assert.deepEqual(brief.keyActors, []);
    assert.equal(brief.riskLevel, 'MEDIUM');
    assert.equal(brief.sourceType, 'Independent Media');
    assert.deepEqual(brief.paper2Prompts, { identify: '', explain: '', evaluate: '' });
});

test('defaults to gemini-3.5-flash-lite with systemInstruction, minimal thinkingLevel, no temperature, and header auth', () => {
    assert.equal(_test.DEFAULT_GEMINI_MODEL, 'gemini-3.5-flash-lite');
    const req = _test.buildGeminiRequest('gemini-3.5-flash-lite', 'Sample user article', 'secret-test-key');

    assert.equal(
        req.url,
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent'
    );
    assert.ok(!req.url.includes('secret-test-key'), 'API key must not appear in URL query string');
    assert.equal(req.headers['x-goog-api-key'], 'secret-test-key');
    assert.ok(req.body.systemInstruction?.parts?.[0]?.text.includes('IB Global Politics'));
    assert.equal(req.body.contents.length, 1);
    assert.equal(req.body.contents[0].role, 'user');
    assert.equal(req.body.contents[0].parts[0].text, 'Sample user article');
    assert.equal('temperature' in req.body.generationConfig, false);
    assert.deepEqual(req.body.generationConfig.thinkingConfig, { thinkingLevel: 'minimal' });

    const proReq = _test.buildGeminiRequest('gemini-3.1-pro-preview', 'Sample user article', 'secret-test-key');
    assert.equal('thinkingConfig' in proReq.body.generationConfig, false, 'Pro overrides should not receive minimal thinkingLevel');
});

test('rejects safety-blocked, recitation, truncated MAX_TOKENS, and empty Gemini candidate payloads instead of returning 200 OK', () => {
    assert.throws(
        () => _test.extractCandidateJsonText({ promptFeedback: { blockReason: 'SAFETY' }, candidates: [] }),
        (err) => err.statusCode === 422 && /safety/i.test(err.message)
    );
    assert.throws(
        () => _test.extractCandidateJsonText({ candidates: [{ finishReason: 'RECITATION', content: { parts: [] } }] }),
        (err) => err.statusCode === 422
    );
    assert.throws(
        () => _test.extractCandidateJsonText({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{"oneLiner":"cut' }] } }] }),
        (err) => err.statusCode === 502 && /truncated/i.test(err.message)
    );
    assert.throws(
        () => _test.extractCandidateJsonText({ candidates: [] }),
        (err) => err.statusCode === 502 && /empty/i.test(err.message)
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
            headers: { 'x-goog-api-key': 'header-key' }
        });
        assert.equal(res.status, 200);
        assert.equal(capturedHeaders['Content-Type'], 'application/json');
        assert.equal(capturedHeaders['x-goog-api-key'], 'header-key');
    } finally {
        global.fetch = originalFetch;
    }
});
