import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('curated case studies remain balanced, auditable, and Nexus-compatible', async t => {
    const vite = await createServer({
        appType: 'custom',
        logLevel: 'silent',
        server: { middlewareMode: true },
    });
    t.after(() => vite.close());

    const [{ CASE_STUDIES_2026, toForecastRecord }, { GUIDED_TOURS }, focusData, eventAnalysis, theoryData] = await Promise.all([
        vite.ssrLoadModule('/src/caseStudies2026.js'),
        vite.ssrLoadModule('/src/nexusTours.js'),
        vite.ssrLoadModule('/src/nexusFocusData.js'),
        vite.ssrLoadModule('/src/eventAnalysis.js'),
        vite.ssrLoadModule('/src/theories.js'),
    ]);

    assert.equal(CASE_STUDIES_2026.length, 9);
    assert.equal(new Set(CASE_STUDIES_2026.map(item => item.id)).size, CASE_STUDIES_2026.length);

    const regionText = CASE_STUDIES_2026.flatMap(item => item.regionTags).join(' ');
    for (const expectedRegion of ['Africa', 'Asia', 'Middle East', 'Latin America', 'North America', 'Pacific', 'Arctic']) {
        assert.match(regionText, new RegExp(expectedRegion, 'i'));
    }

    const issueDimensions = new Set(CASE_STUDIES_2026.flatMap(item => item.issueDimensions));
    assert.ok(issueDimensions.size >= 15, 'portfolio should span many issue dimensions');
    assert.ok(new Set(CASE_STUDIES_2026.map(item => item.broadCategory)).size >= 4);
    assert.ok(CASE_STUDIES_2026.some(item => item.regionTags.includes('Europe')));
    assert.ok(issueDimensions.has('AI governance'));

    for (const caseStudy of CASE_STUDIES_2026) {
        assert.match(caseStudy.updatedAt, /^2026-\d{2}-\d{2}$/);
        assert.ok(caseStudy.updatedAt <= '2026-08-07');
        assert.ok(caseStudy.sources.length > 0);
        assert.ok(caseStudy.waypoints.length >= 4 && caseStudy.waypoints.length <= 5);
        assert.equal(caseStudy.confidence, 'high');

        for (const source of caseStudy.sources) {
            assert.match(source.url, /^https:\/\//);
            assert.ok(source.title && source.publisher && source.perspective);
        }

        for (const actorId of caseStudy.nexusNodeIds) {
            assert.ok(focusData.NEXUS_ACTORS[actorId], `${caseStudy.id} has unknown actor ${actorId}`);
        }

        for (const waypoint of caseStudy.waypoints) {
            assert.ok(caseStudy.nexusNodeIds.includes(waypoint.nodeId));
            assert.ok(waypoint.narration && waypoint.focusQuestion);
        }

        const forecast = toForecastRecord(caseStudy);
        assert.equal(forecast.caseStudyId, caseStudy.id);
        assert.equal(forecast.isCaseStudy, true);
        assert.equal(forecast.isEditorial, true);
        assert.deepEqual(forecast.nexusActorIds, caseStudy.nexusNodeIds);
        assert.equal(forecast.statusSummary, caseStudy.statusSummary);
        assert.match(forecast.url, /^https:\/\//);
    }

    assert.deepEqual(
        GUIDED_TOURS.map(item => item.id),
        CASE_STUDIES_2026.map(item => item.id),
        'guided briefings should project from the canonical cases',
    );

    const relationships = focusData.getNexusRelationships();
    assert.ok(relationships.length > 0);
    assert.deepEqual(
        focusData.inferForecastActorIds(toForecastRecord(CASE_STUDIES_2026[0])),
        CASE_STUDIES_2026[0].nexusNodeIds,
    );

    const tuvalu = toForecastRecord(CASE_STUDIES_2026.find(item => item.id === 'tuvalu-australia-falepili-union'));
    const fiveWOneH = eventAnalysis.generate5W1H(tuvalu);
    assert.equal(fiveWOneH.where, 'Pacific · Oceania · Small Island States');
    assert.match(fiveWOneH.why, /climate adaptation/i);
    assert.deepEqual(Object.keys(eventAnalysis.getGlobalChallenges(tuvalu)), ['Security', 'Borders', 'Environment', 'Equality']);
    assert.match(theoryData.getTheoryInterpretation('Realism', tuvalu), /^Interpretive lens—not an established factual conclusion\./);
});
