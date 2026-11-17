import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const EDITORIAL_SNAPSHOT_DATE = '2026-08-10';
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CORE_PERSPECTIVE_TYPES = ['independent', 'institutional', 'local'];
const WAYPOINT_PERSPECTIVE_TYPES = new Set([...CORE_PERSPECTIVE_TYPES, 'synthesis']);
const MAP_MODES = new Set(['global', 'point', 'regional', 'route']);

const assertNonEmptyString = (value, message) => {
    assert.equal(typeof value, 'string', message);
    assert.ok(value.trim(), message);
};

const assertValidEditorialDate = (value, message) => {
    assert.match(value, ISO_DATE_PATTERN, message);
    assert.ok(Number.isFinite(Date.parse(`${value}T00:00:00Z`)), message);
    assert.equal(new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10), value, message);
};

test('curated case studies remain balanced across 7 regions x 6 lenses, auditable, archival-ready, and Nexus-compatible', async t => {
    const vite = await createServer({
        configFile: false,
        cacheDir: `/tmp/vite-gcc-content-test-${process.pid}`,
        appType: 'custom',
        logLevel: 'silent',
        optimizeDeps: { noDiscovery: true },
        server: { middlewareMode: true },
    });
    t.after(() => vite.close());

    const [
        {
            CASE_STUDIES_2026,
            ARCHIVED_CASE_STUDIES_2026,
            ALL_CASE_STUDIES_2026,
            CANONICAL_REGIONS_7,
            ISSUE_LENSES_6,
            BROAD_CATEGORIES,
            ISSUE_LENS_TO_BROAD_CATEGORY,
            CONTENT_REVIEW_DATE,
            addDays,
            normalizeCaseStudy,
            toForecastRecord,
        },
        { GUIDED_TOURS, projectGuidedTour },
        focusData,
        eventAnalysis,
        theoryData,
        stalenessCli,
    ] = await Promise.all([
        vite.ssrLoadModule('/src/caseStudies2026.js'),
        vite.ssrLoadModule('/src/nexusTours.js'),
        vite.ssrLoadModule('/src/nexusFocusData.js'),
        vite.ssrLoadModule('/src/eventAnalysis.js'),
        vite.ssrLoadModule('/src/theories.js'),
        import('../../scripts/check-case-staleness.mjs'),
    ]);

    const regionSet = new Set(CANONICAL_REGIONS_7);
    const lensSet = new Set(ISSUE_LENSES_6);
    const broadCategorySet = new Set(BROAD_CATEGORIES);
    const allCaseIds = new Set(ALL_CASE_STUDIES_2026.map(item => item.id));

    assert.ok(broadCategorySet.has('Governance & Rights'), 'Option A promotes Governance & Rights into Broad_Category');
    assert.equal(CONTENT_REVIEW_DATE, EDITORIAL_SNAPSHOT_DATE, 'editorial snapshot should match the canonical baseline review date');
    assert.ok(CASE_STUDIES_2026.length >= 29, 'active case library must retain >= 29 baseline cases');
    assert.equal(ALL_CASE_STUDIES_2026.length, CASE_STUDIES_2026.length + ARCHIVED_CASE_STUDIES_2026.length);
    assert.equal(allCaseIds.size, ALL_CASE_STUDIES_2026.length, 'case IDs must be globally unique across active and archived sets');

    // Reject mismatched issueLens / broadCategory pairs
    assert.throws(
        () => normalizeCaseStudy({
            ...CASE_STUDIES_2026[0],
            id: 'mismatch-lens-test',
            issueLens: 'Governance & Rights',
            broadCategory: 'Economy & Trade',
        }),
        RangeError,
        'normalizeCaseStudy must reject mismatched issueLens and broadCategory pairs',
    );

    const latestEditorialReviewDate = CASE_STUDIES_2026.reduce(
        (maxDate, item) => (item.updatedAt > maxDate ? item.updatedAt : maxDate),
        EDITORIAL_SNAPSHOT_DATE,
    );

    const regionText = CASE_STUDIES_2026.flatMap(item => item.regionTags).join(' ');
    for (const expectedRegion of ['Africa', 'Asia', 'Middle East', 'Latin America', 'North America', 'Pacific', 'Arctic', 'Europe']) {
        assert.match(regionText, new RegExp(expectedRegion, 'i'));
    }

    assert.equal(new Set(CASE_STUDIES_2026.map(item => item.coverageRegion)).size, 7, 'all 7 canonical coverage regions must be represented');
    assert.equal(new Set(CASE_STUDIES_2026.map(item => item.issueLens)).size, 6, 'all 6 issue lenses must be represented');
    assert.equal(new Set(CASE_STUDIES_2026.map(item => item.broadCategory)).size, 6, 'all 6 Broad_Category values (including Governance & Rights) must be represented');

    const issueDimensions = new Set(CASE_STUDIES_2026.flatMap(item => item.issueDimensions));
    assert.ok(issueDimensions.size >= 15, 'portfolio should span many issue dimensions');
    assert.ok(issueDimensions.has('AI governance'));

    for (const caseStudy of ALL_CASE_STUDIES_2026) {
        const isArchived = caseStudy.status === 'archived';
        assert.ok(['active', 'archived'].includes(caseStudy.status), `${caseStudy.id} has invalid lifecycle status`);
        assert.match(caseStudy.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `${caseStudy.id} should be a stable slug`);
        assertNonEmptyString(caseStudy.title, `${caseStudy.id} needs a title`);
        assertNonEmptyString(caseStudy.subtitle, `${caseStudy.id} needs a subtitle`);
        assertNonEmptyString(caseStudy.statusSummary, `${caseStudy.id} needs an attributed status summary`);
        assertNonEmptyString(caseStudy.whyItMatters, `${caseStudy.id} needs an analytical rationale`);
        assertNonEmptyString(caseStudy.uncertainty, `${caseStudy.id} needs an uncertainty note`);
        assertNonEmptyString(caseStudy.editorialCaution, `${caseStudy.id} needs an editorial caution`);
        assert.ok(regionSet.has(caseStudy.coverageRegion), `${caseStudy.id} has non-canonical coverageRegion ${caseStudy.coverageRegion}`);
        assert.ok(lensSet.has(caseStudy.issueLens), `${caseStudy.id} has non-canonical issueLens ${caseStudy.issueLens}`);
        assert.ok(broadCategorySet.has(caseStudy.broadCategory), `${caseStudy.id} has non-canonical broadCategory ${caseStudy.broadCategory}`);
        assert.equal(
            ISSUE_LENS_TO_BROAD_CATEGORY[caseStudy.issueLens],
            caseStudy.broadCategory,
            `${caseStudy.id} issueLens ${caseStudy.issueLens} must map to ${caseStudy.broadCategory}`,
        );
        assert.ok(caseStudy.regionTags.length > 0, `${caseStudy.id} needs region tags`);
        assert.ok(caseStudy.issueDimensions.length > 0, `${caseStudy.id} needs issue dimensions`);
        assert.ok(caseStudy.actors.length > 0, `${caseStudy.id} needs actors`);
        assert.ok(caseStudy.nexusNodeIds.length > 0, `${caseStudy.id} needs Nexus actors`);
        assert.equal(new Set(caseStudy.nexusNodeIds).size, caseStudy.nexusNodeIds.length, `${caseStudy.id} repeats a Nexus actor`);

        assertValidEditorialDate(caseStudy.updatedAt, `${caseStudy.id} has an invalid updatedAt`);
        assert.ok(['high', 'medium'].includes(caseStudy.confidence), `${caseStudy.id} has an unsupported confidence`);
        assert.equal(typeof caseStudy.featured, 'boolean', `${caseStudy.id} featured must be boolean`);
        assert.ok(['standard', 'high'].includes(caseStudy.sensitivity), `${caseStudy.id} has invalid sensitivity`);
        assert.ok(Number.isInteger(caseStudy.reviewCadenceDays) && caseStudy.reviewCadenceDays > 0, `${caseStudy.id} has invalid review cadence`);
        assertValidEditorialDate(caseStudy.reviewBy, `${caseStudy.id} has an invalid reviewBy`);
        assert.ok(caseStudy.reviewBy >= caseStudy.updatedAt, `${caseStudy.id} reviewBy precedes updatedAt`);

        if (!isArchived) {
            assert.ok(caseStudy.updatedAt <= latestEditorialReviewDate, `${caseStudy.id} has an invalid future updatedAt`);
            assert.equal(
                caseStudy.reviewBy,
                addDays(caseStudy.updatedAt, caseStudy.reviewCadenceDays),
                `${caseStudy.id} reviewBy must equal updatedAt + reviewCadenceDays`,
            );
            assert.ok(caseStudy.reviewBy >= EDITORIAL_SNAPSHOT_DATE, `${caseStudy.id} precedes baseline editorial review snapshot`);
        } else {
            assertValidEditorialDate(caseStudy.archivedAt, `${caseStudy.id} archived record requires ISO archivedAt`);
            assertNonEmptyString(caseStudy.archivedReason, `${caseStudy.id} archived record requires archivedReason`);
            if (caseStudy.supersededById) {
                assert.ok(allCaseIds.has(caseStudy.supersededById), `${caseStudy.id} supersededById ${caseStudy.supersededById} does not exist`);
            }
        }

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
            for (const alternate of source.alternateUrls || []) {
                assert.match(alternate.url, /^https:\/\//, `${caseStudy.id} has an invalid supplemental alternate URL`);
                assertNonEmptyString(alternate.label, `${caseStudy.id} has an unlabeled supplemental alternate URL`);
                assert.notEqual(alternate.url, source.url, `${caseStudy.id} repeats its supplemental primary URL as an alternate`);
            }
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
        assert.equal(forecast.reviewStatus, caseStudy.reviewStatus);
        assert.equal(forecast.isCaseStudy, true);
        assert.equal(forecast.isEditorial, true);
        assert.equal(forecast.issueLens, caseStudy.issueLens);
        assert.equal(forecast.Broad_Category, caseStudy.broadCategory);
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
        'guided briefings should project from the canonical active cases',
    );
    assert.equal(GUIDED_TOURS.length, CASE_STUDIES_2026.length);

    for (const [index, tour] of GUIDED_TOURS.entries()) {
        const caseStudy = CASE_STUDIES_2026[index];
        assert.equal(tour.caseStudyId, caseStudy.id);
        assert.equal(tour.reviewStatus, caseStudy.reviewStatus);
        assert.equal(tour.title, caseStudy.title);
        assert.equal(tour.subtitle, caseStudy.subtitle);
        assert.equal(tour.coverageRegion, caseStudy.coverageRegion);
        assert.equal(tour.issueLens, caseStudy.issueLens);
        assert.equal(tour.broadCategory, caseStudy.broadCategory);
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

    // Verify docs/CASE_STUDY_EDITORIAL_STANDARD.md 29-case baseline table stays in sync with CASE_STUDIES_2026
    const standardDoc = fs.readFileSync(path.join(REPO_ROOT, 'docs/CASE_STUDY_EDITORIAL_STANDARD.md'), 'utf8');
    const tableRows = [...standardDoc.matchAll(/^\|\s*\d+\s*\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|$/gm)];
    assert.equal(tableRows.length, 29, 'CASE_STUDY_EDITORIAL_STANDARD.md must list all 29 baseline cases');
    const byId = new Map(ALL_CASE_STUDIES_2026.map(item => [item.id, item]));
    for (const [, id, , docRegion, docLens, docBroad] of tableRows) {
        const record = byId.get(id);
        assert.ok(record, `Baseline table case ${id} must exist in ALL_CASE_STUDIES_2026`);
        assert.equal(record.coverageRegion, docRegion, `Baseline table coverageRegion mismatch on ${id}`);
        assert.equal(record.issueLens, docLens, `Baseline table issueLens mismatch on ${id}`);
        assert.equal(record.broadCategory, docBroad, `Baseline table broadCategory mismatch on ${id}`);
    }

    // Verify check-case-staleness.mjs CLI argument parsing & post-renewal Group 1 / Group 2 split
    assert.equal(stalenessCli.parseCliArgs(['--as-of=2026-11-17']).referenceDate, '2026-11-17');
    assert.equal(stalenessCli.parseCliArgs(['--as-of', '2026-11-17', '--strict']).strict, true);
    assert.equal(stalenessCli.parseCliArgs(['--as-of', '2026-11-17']).referenceDate, '2026-11-17');
    assert.throws(() => stalenessCli.parseCliArgs(['--as-of=not-a-date']), RangeError);
    assert.throws(() => stalenessCli.parseCliArgs(['--as-of=2026-02-30']), RangeError);
    const stalenessReport = stalenessCli.analyzeCaseStaleness(CASE_STUDIES_2026, [], '2026-11-17');
    assert.equal(stalenessReport.overdueCount, 9, '8 standard-sensitivity cases plus unre-reviewed Tuvalu remain in Group 2 update-in-progress');
    assert.equal(stalenessReport.dueWithin14DaysCount, 10);
    assert.equal(stalenessReport.freshCount, 10);

    const expectedGroup2Ids = [
        'amazon-indigenous-co-governance',
        'eu-ai-act-transparency-implementation',
        'high-seas-bbnj-implementation',
        'mekong-energy-food-bargain',
        'moldova-transnistria-energy-eu-accession',
        'mongolia-coal-critical-minerals-transition',
        'syria-transition-return-sanctions',
        'tuvalu-australia-falepili-union',
        'zambia-electricity-reset-climate-access',
    ];
    assert.deepEqual(
        stalenessReport.overdue.map(item => item.id).sort(),
        expectedGroup2Ids,
        'overdue cases at 2026-11-17 must match the exact 9 Group 2 cases',
    );
    assert.deepEqual(
        CASE_STUDIES_2026.filter(item => item.reviewStatus === 'update-in-progress').map(item => item.id).sort(),
        expectedGroup2Ids,
        'explicit reviewStatus: update-in-progress must be set on and only on the 9 Group 2 cases',
    );

    for (const item of CASE_STUDIES_2026) {
        if ((item.sensitivity === 'high' || item.reviewCadenceDays <= 14) && item.reviewStatus !== 'update-in-progress') {
            assert.ok(
                item.reviewBy >= '2026-11-17',
                `high-sensitivity / <=14d case ${item.id} must be substantively renewed (reviewBy=${item.reviewBy})`,
            );
        }
    }

    // Verify archival lifecycle normalization and tour projection without mutating active library
    const syntheticArchived = normalizeCaseStudy({
        ...CASE_STUDIES_2026[0],
        id: 'synthetic-archived-snapshot',
        status: 'archived',
        archivedAt: '2027-01-15',
        archivedReason: 'Superseded by updated commission protocol.',
        supersededById: CASE_STUDIES_2026[0].id,
    });
    const archivedTour = projectGuidedTour(syntheticArchived);
    assert.equal(archivedTour.status, 'archived');
    assert.equal(archivedTour.archivedAt, '2027-01-15');
    assert.equal(archivedTour.supersededById, CASE_STUDIES_2026[0].id);

    const relationships = focusData.getNexusRelationships();
    assert.ok(relationships.length > 0);
    assert.deepEqual(
        focusData.inferForecastActorIds(toForecastRecord(CASE_STUDIES_2026[0])),
        CASE_STUDIES_2026[0].nexusNodeIds,
    );

    // Synthetic fixture decoupled from any single live case ID so future archival never breaks 5W1H tests
    const syntheticFixture = toForecastRecord(normalizeCaseStudy({
        ...CASE_STUDIES_2026[0],
        id: 'synthetic-governance-fixture',
        coverageRegion: 'Pacific Islands',
        regionTags: ['Pacific', 'Oceania', 'Small Island States'],
        issueLens: 'Governance & Rights',
        broadCategory: 'Governance & Rights',
        issueDimensions: ['Climate adaptation', 'Sovereignty', 'Territorial mobility', 'Local participation'],
        whyItMatters: 'Tests climate adaptation, constitutional sovereignty, and participatory governance.',
    }));
    const fiveWOneH = eventAnalysis.generate5W1H(syntheticFixture);
    assert.equal(fiveWOneH.where, 'Pacific · Oceania · Small Island States');
    assert.match(fiveWOneH.why, /climate adaptation/i);
    assert.deepEqual(Object.keys(eventAnalysis.getGlobalChallenges(syntheticFixture)), ['Security', 'Borders', 'Environment', 'Equality']);
    assert.match(theoryData.getTheoryInterpretation('Realism', syntheticFixture), /^Interpretive lens—not an established factual conclusion\./);

    // Non-case-study Governance & Rights event challenge mapping
    const nonCaseGovChallenges = eventAnalysis.getGlobalChallenges({
        'Entity/Subject': 'Constitutional Referendum',
        'Key Player/Organization': 'Electoral Commission',
        Broad_Category: 'Governance & Rights',
    });
    assert.deepEqual(Object.keys(nonCaseGovChallenges), ['Equality', 'Identity', 'Security']);
});
