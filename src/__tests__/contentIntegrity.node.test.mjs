import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const EDITORIAL_SNAPSHOT_DATE = '2026-08-10';
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CORE_PERSPECTIVE_TYPES = ['independent', 'institutional', 'local'];
const WAYPOINT_PERSPECTIVE_TYPES = new Set([...CORE_PERSPECTIVE_TYPES, 'synthesis']);
const MAP_MODES = new Set(['global', 'point', 'regional', 'route']);
const BROAD_CATEGORIES = new Set([
    'Economy & Trade',
    'Environment & Energy',
    'Geopolitics & Conflict',
    'Health & Society',
    'Technology & Science',
]);

const assertNonEmptyString = (value, message) => {
    assert.equal(typeof value, 'string', message);
    assert.ok(value.trim(), message);
};

const assertValidEditorialDate = (value, message) => {
    assert.match(value, ISO_DATE_PATTERN, message);
    assert.ok(Number.isFinite(Date.parse(`${value}T00:00:00Z`)), message);
    assert.equal(new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10), value, message);
};

test('curated case studies remain balanced, auditable, and Nexus-compatible', async t => {
    const vite = await createServer({
        appType: 'custom',
        logLevel: 'silent',
        server: { middlewareMode: true },
    });
    t.after(() => vite.close());

    const [{ CASE_STUDIES_2026, CONTENT_REVIEW_DATE, toForecastRecord }, { GUIDED_TOURS }, focusData, eventAnalysis, theoryData] = await Promise.all([
        vite.ssrLoadModule('/src/caseStudies2026.js'),
        vite.ssrLoadModule('/src/nexusTours.js'),
        vite.ssrLoadModule('/src/nexusFocusData.js'),
        vite.ssrLoadModule('/src/eventAnalysis.js'),
        vite.ssrLoadModule('/src/theories.js'),
    ]);

    assert.equal(CONTENT_REVIEW_DATE, EDITORIAL_SNAPSHOT_DATE, 'editorial snapshot should match the canonical review date');
    assert.equal(CASE_STUDIES_2026.length, 29);
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
        assert.match(caseStudy.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `${caseStudy.id} should be a stable slug`);
        assertNonEmptyString(caseStudy.title, `${caseStudy.id} needs a title`);
        assertNonEmptyString(caseStudy.subtitle, `${caseStudy.id} needs a subtitle`);
        assertNonEmptyString(caseStudy.statusSummary, `${caseStudy.id} needs an attributed status summary`);
        assertNonEmptyString(caseStudy.whyItMatters, `${caseStudy.id} needs an analytical rationale`);
        assertNonEmptyString(caseStudy.uncertainty, `${caseStudy.id} needs an uncertainty note`);
        assertNonEmptyString(caseStudy.editorialCaution, `${caseStudy.id} needs an editorial caution`);
        assertNonEmptyString(caseStudy.coverageRegion, `${caseStudy.id} needs a coverage region`);
        assert.ok(BROAD_CATEGORIES.has(caseStudy.broadCategory), `${caseStudy.id} has a non-canonical broad category`);
        assert.ok(caseStudy.regionTags.length > 0, `${caseStudy.id} needs region tags`);
        assert.ok(caseStudy.issueDimensions.length > 0, `${caseStudy.id} needs issue dimensions`);
        assert.ok(caseStudy.actors.length > 0, `${caseStudy.id} needs actors`);
        assert.ok(caseStudy.nexusNodeIds.length > 0, `${caseStudy.id} needs Nexus actors`);
        assert.equal(new Set(caseStudy.nexusNodeIds).size, caseStudy.nexusNodeIds.length, `${caseStudy.id} repeats a Nexus actor`);

        assertValidEditorialDate(caseStudy.updatedAt, `${caseStudy.id} has an invalid updatedAt`);
        assert.ok(caseStudy.updatedAt <= EDITORIAL_SNAPSHOT_DATE, `${caseStudy.id} is dated after the editorial snapshot`);
        assert.ok(['high', 'medium'].includes(caseStudy.confidence), `${caseStudy.id} has an unsupported confidence`);
        assert.equal(typeof caseStudy.featured, 'boolean', `${caseStudy.id} featured must be boolean`);
        assert.ok(['standard', 'high'].includes(caseStudy.sensitivity), `${caseStudy.id} has invalid sensitivity`);
        assert.ok(Number.isInteger(caseStudy.reviewCadenceDays) && caseStudy.reviewCadenceDays > 0, `${caseStudy.id} has invalid review cadence`);
        assertValidEditorialDate(caseStudy.reviewBy, `${caseStudy.id} has an invalid reviewBy`);
        assert.ok(caseStudy.reviewBy >= caseStudy.updatedAt, `${caseStudy.id} reviewBy precedes updatedAt`);
        assert.ok(caseStudy.reviewBy >= EDITORIAL_SNAPSHOT_DATE, `${caseStudy.id} is overdue for editorial review`);

        assert.ok(MAP_MODES.has(caseStudy.map.mode), `${caseStudy.id} has invalid map mode ${caseStudy.map.mode}`);
        assert.ok(Array.isArray(caseStudy.map.locations) && caseStudy.map.locations.length > 0, `${caseStudy.id} needs map locations`);
        for (const location of caseStudy.map.locations) {
            assertNonEmptyString(location.label, `${caseStudy.id} has an unlabeled map location`);
            assert.ok(Number.isFinite(Number(location.latitude)), `${caseStudy.id} has invalid map latitude`);
            assert.ok(Number.isFinite(Number(location.longitude)), `${caseStudy.id} has invalid map longitude`);
            assert.ok(Number(location.latitude) >= -90 && Number(location.latitude) <= 90, `${caseStudy.id} map latitude is out of range`);
            assert.ok(Number(location.longitude) >= -180 && Number(location.longitude) <= 180, `${caseStudy.id} map longitude is out of range`);
        }

        assert.equal(caseStudy.sources.length, 3, `${caseStudy.id} needs exactly three core sources`);
        assert.deepEqual(
            caseStudy.sources.map(source => source.perspectiveType).sort(),
            CORE_PERSPECTIVE_TYPES,
            `${caseStudy.id} needs one local, institutional, and independent source`,
        );
        assert.ok(caseStudy.waypoints.length >= 4 && caseStudy.waypoints.length <= 5);

        for (const source of caseStudy.sources) {
            assert.match(source.url, /^https:\/\//);
            assertNonEmptyString(source.title, `${caseStudy.id} has a source without a title`);
            assertNonEmptyString(source.publisher, `${caseStudy.id} has a source without a publisher`);
            assertNonEmptyString(source.perspective, `${caseStudy.id} has a source without a perspective`);
            assertNonEmptyString(source.supports, `${caseStudy.id} has a source without a supports statement`);
            assertNonEmptyString(source.dateLabel, `${caseStudy.id} has a source without transparent timing metadata`);
            for (const alternate of source.alternateUrls || []) {
                assert.match(alternate.url, /^https:\/\//, `${caseStudy.id} has an invalid alternate source URL`);
                assertNonEmptyString(alternate.label, `${caseStudy.id} has an unlabeled alternate source URL`);
                assert.notEqual(alternate.url, source.url, `${caseStudy.id} repeats its primary URL as an alternate`);
            }
            if (source.publishedAt) {
                assertValidEditorialDate(source.publishedAt, `${caseStudy.id} has an invalid source publication date`);
            } else {
                assert.equal(source.sourceType, 'living-reference', `${caseStudy.id} has an undated source that is not marked as living`);
                assert.ok(
                    source.reviewedAt || source.dataThrough || source.updatedAt || source.milestoneDate,
                    `${caseStudy.id} has a living source without timing metadata`,
                );
            }
        }

        for (const source of caseStudy.supplementalSources) {
            assert.match(source.url, /^https:\/\//);
            assertNonEmptyString(source.title, `${caseStudy.id} has a supplemental source without a title`);
            assertNonEmptyString(source.publisher, `${caseStudy.id} has a supplemental source without a publisher`);
            assertNonEmptyString(source.dateLabel, `${caseStudy.id} has a supplemental source without transparent timing metadata`);
            if (source.publishedAt) {
                assertValidEditorialDate(source.publishedAt, `${caseStudy.id} has an invalid supplemental publication date`);
            } else {
                assert.equal(source.sourceType, 'living-reference', `${caseStudy.id} has an undated supplemental source that is not marked as living`);
            }
        }

        for (const actorId of caseStudy.nexusNodeIds) {
            assert.ok(focusData.NEXUS_ACTORS[actorId], `${caseStudy.id} has unknown actor ${actorId}`);
        }

        for (const waypoint of caseStudy.waypoints) {
            assert.ok(focusData.NEXUS_ACTORS[waypoint.nodeId], `${caseStudy.id} waypoint has unknown actor ${waypoint.nodeId}`);
            assert.ok(caseStudy.nexusNodeIds.includes(waypoint.nodeId), `${caseStudy.id} waypoint actor is absent from nexusNodeIds`);
            assertNonEmptyString(waypoint.title, `${caseStudy.id} has an untitled waypoint`);
            assertNonEmptyString(waypoint.perspectiveLabel, `${caseStudy.id} waypoint needs a perspective label`);
            assert.ok(WAYPOINT_PERSPECTIVE_TYPES.has(waypoint.perspectiveType), `${caseStudy.id} has invalid waypoint perspective ${waypoint.perspectiveType}`);
            assertNonEmptyString(waypoint.narration, `${caseStudy.id} waypoint needs narration`);
            assertNonEmptyString(waypoint.focusQuestion, `${caseStudy.id} waypoint needs a focus question`);
        }

        const forecast = toForecastRecord(caseStudy);
        assert.equal(forecast.caseStudyId, caseStudy.id);
        assert.equal(forecast.isCaseStudy, true);
        assert.equal(forecast.isEditorial, true);
        assert.deepEqual(forecast.nexusActorIds, caseStudy.nexusNodeIds);
        assert.equal(forecast.statusSummary, caseStudy.statusSummary);
        assert.match(forecast.url, /^https:\/\//);
        assert.equal(forecast.confidence, caseStudy.confidence);
        assert.equal(forecast.coverageRegion, caseStudy.coverageRegion);
        assert.equal(forecast.featured, caseStudy.featured);
        assert.equal(forecast.sensitivity, caseStudy.sensitivity);
        assert.equal(forecast.reviewCadenceDays, caseStudy.reviewCadenceDays);
        assert.equal(forecast.reviewBy, caseStudy.reviewBy);
        assert.deepEqual(forecast.map, caseStudy.map);
        assert.deepEqual(forecast.sources, caseStudy.sources);
        assert.deepEqual(forecast.waypoints, caseStudy.waypoints);
    }

    assert.deepEqual(
        GUIDED_TOURS.map(item => item.id),
        CASE_STUDIES_2026.map(item => item.id),
        'guided briefings should project from the canonical cases',
    );
    assert.equal(GUIDED_TOURS.length, 29);

    for (const [index, tour] of GUIDED_TOURS.entries()) {
        const caseStudy = CASE_STUDIES_2026[index];
        assert.equal(tour.caseStudyId, caseStudy.id);
        assert.equal(tour.title, caseStudy.title);
        assert.equal(tour.subtitle, caseStudy.subtitle);
        assert.equal(tour.coverageRegion, caseStudy.coverageRegion);
        assert.equal(tour.featured, caseStudy.featured);
        assert.equal(tour.sensitivity, caseStudy.sensitivity);
        assert.equal(tour.reviewBy, caseStudy.reviewBy);
        assert.deepEqual(tour.regionTags, caseStudy.regionTags);
        assert.deepEqual(tour.issueDimensions, caseStudy.issueDimensions);
        assert.deepEqual(tour.actors, caseStudy.actors);
        assert.deepEqual(tour.map, caseStudy.map);
        assert.deepEqual(tour.sources, caseStudy.sources);
        assert.deepEqual(tour.waypoints, caseStudy.waypoints);
    }

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
