const test = require('node:test');
const assert = require('node:assert/strict');

const { _test } = require('../ai-summary');

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
