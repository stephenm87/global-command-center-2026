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

test('curated case studies remain balanced across 7 regions x 6 lenses, auditable, archival-ready, and actor-consistent', async t => {
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
            COVERAGE_REGION_ALIASES,
            ISSUE_LENSES_6,
            BROAD_CATEGORIES,
            ISSUE_LENS_TO_BROAD_CATEGORY,
            CONTENT_REVIEW_DATE,
            UNIT1_CORE_CONCEPTS,
            IB_THEMATIC_STUDIES,
            INFLUENCE_CHECK_STAGES,
            INFLUENCE_RATINGS,
            countWords,
            computeBriefingReadingTimes,
            addDays,
            normalizeCaseStudy,
            toForecastRecord,
        },
        { GUIDED_TOURS, projectGuidedTour },
        actorData,
        eventAnalysis,
        theoryData,
        stalenessCli,
    ] = await Promise.all([
        vite.ssrLoadModule('/src/caseStudies2026.js'),
        vite.ssrLoadModule('/src/nexusTours.js'),
        vite.ssrLoadModule('/src/briefingActors.js'),
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

        const coreUrlSet = new Set();
        for (const source of caseStudy.sources) {
            assert.ok(!coreUrlSet.has(source.url), `${caseStudy.id} repeats core source URL ${source.url}`);
            coreUrlSet.add(source.url);
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

        const suppUrlSet = new Set();
        for (const source of caseStudy.supplementalSources) {
            assert.ok(!coreUrlSet.has(source.url), `${caseStudy.id} duplicates core source URL ${source.url} in supplementalSources`);
            assert.ok(!suppUrlSet.has(source.url), `${caseStudy.id} repeats supplemental source URL ${source.url}`);
            suppUrlSet.add(source.url);
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
            assert.ok(actorData.BRIEFING_ACTORS[actorId], `${caseStudy.id} has unknown actor ${actorId}`);
        }

        for (const waypoint of caseStudy.waypoints) {
            assert.ok(actorData.BRIEFING_ACTORS[waypoint.nodeId], `${caseStudy.id} waypoint has unknown actor ${waypoint.nodeId}`);
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
    const stalenessReport = stalenessCli.analyzeCaseStaleness(CASE_STUDIES_2026, [], '2026-11-20');
    assert.equal(stalenessReport.overdueCount, 8, '7 remaining standard-sensitivity cases plus unre-reviewed Tuvalu stay in Group 2 update-in-progress after Syria Batch 1 renewal');
    assert.equal(stalenessReport.dueWithin14DaysCount, 10);
    assert.equal(stalenessReport.freshCount, 11);

    const expectedGroup2Ids = [
        'amazon-indigenous-co-governance',
        'eu-ai-act-transparency-implementation',
        'high-seas-bbnj-implementation',
        'mekong-energy-food-bargain',
        'moldova-transnistria-energy-eu-accession',
        'mongolia-coal-critical-minerals-transition',
        'tuvalu-australia-falepili-union',
        'zambia-electricity-reset-climate-access',
    ];
    assert.deepEqual(
        stalenessReport.overdue.map(item => item.id).sort(),
        expectedGroup2Ids,
        'overdue cases at 2026-11-20 must match the exact 8 remaining Group 2 cases',
    );
    assert.deepEqual(
        CASE_STUDIES_2026.filter(item => item.reviewStatus === 'update-in-progress').map(item => item.id).sort(),
        expectedGroup2Ids,
        'explicit reviewStatus: update-in-progress must be set on and only on the 8 remaining Group 2 cases',
    );

    for (const item of CASE_STUDIES_2026) {
        if ((item.sensitivity === 'high' || item.reviewCadenceDays <= 14) && item.reviewStatus !== 'update-in-progress') {
            assert.ok(
                item.reviewBy >= '2026-11-20',
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

    // Every active case map location must name a real city, site, or country rather than a generic region/continent
    const normalizeLocationLabel = value => String(value || '')
        .trim()
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[\u2013\u2014\-/]+/g, ' ')
        .replace(/\s+/g, ' ');
    const REGION_OR_CONTINENT_LOCATION_LABELS = new Set([
        ...CANONICAL_REGIONS_7,
        ...Object.keys(COVERAGE_REGION_ALIASES),
        'Africa',
        'Americas',
        'Antarctica',
        'Arabian Gulf',
        'Balkans',
        'Caribbean',
        'Central America',
        'Central Europe',
        'East Africa',
        'Eastern Europe',
        'Eurasia',
        'Gulf',
        'Indo-Pacific',
        'Levant',
        'Maghreb',
        'Mediterranean',
        'MENA',
        'Middle East & North Africa',
        'Oceania',
        'Persian Gulf',
        'Red Sea',
        'Sahel',
        'South America',
        'West Africa',
        'Western Europe',
    ].map(normalizeLocationLabel));
    for (const syntheticRegion of ['Asia–Pacific', 'Asia Pacific', 'Latin America & Caribbean', 'Eastern Europe & Eurasia', 'Global Oceans', 'Horn of Africa and Red Sea']) {
        assert.ok(REGION_OR_CONTINENT_LOCATION_LABELS.has(normalizeLocationLabel(syntheticRegion)));
    }
    for (const item of CASE_STUDIES_2026) {
        for (const loc of item.map.locations) {
            const normalized = normalizeLocationLabel(loc.label);
            assert.ok(
                !REGION_OR_CONTINENT_LOCATION_LABELS.has(normalized),
                `Active case ${item.id} uses generic region/continent map label "${loc.label}"`,
            );
        }
    }

    // Owner rule: a state whose claimed capital is internationally contested is named by the state, not the city, on maps and in case prose
    const CONTESTED_CAPITAL_PATTERN = /\b(?:west\s+jerusalem|east\s+jerusalem|jerusalem|al[ -]?quds)\b/i;
    for (const item of ALL_CASE_STUDIES_2026) {
        for (const loc of item.map.locations) {
            assert.ok(
                !CONTESTED_CAPITAL_PATTERN.test(normalizeLocationLabel(loc.label)),
                `${item.id} labels a contested capital ("${loc.label}"); name the state instead`,
            );
        }
        const proseChunks = [
            item.statusSummary,
            item.whyItMatters,
            item.uncertainty,
            item.editorialCaution,
            item.background,
            ...(item.waypoints || []).map(w => w.narration),
            ...(item.keyTerms || []).map(t => t.definition),
            ...(item.debate || []).flatMap(d => [d.claim, d.counterClaim]),
            ...(item.watchFor || []).map(w => w.indicator),
            ...(item.influenceCheck || []).map(s => s.evidence),
            ...Object.values(item.conceptLens || {}),
            ...(item.essayBuilder ? [item.essayBuilder.claim, item.essayBuilder.evidence, item.essayBuilder.counterClaim, item.essayBuilder.judgment] : []),
            ...(item.timeline || []).map(t => t.label),
            ...(item.sources || []).flatMap(s => [s.perspective, s.supports]),
            ...(item.supplementalSources || []).flatMap(s => [s.perspective, s.supports]),
        ].filter(Boolean);
        for (const chunk of proseChunks) {
            assert.ok(
                !CONTESTED_CAPITAL_PATTERN.test(chunk),
                `${item.id} uses a contested capital name in case text ("${chunk.slice(0, 90)}…"); name the state instead`,
            );
        }
    }
    for (const record of CASE_STUDIES_2026) {
        for (const loc of record.map.locations) {
            assertNonEmptyString(loc.role, `${record.id} map location "${loc.label}" must document its role`);
        }
    }

    // Content Depth Standard v2 & C3 Tier 2 validation for upgraded cases (briefingVersion === 2)
    const conceptSet = new Set(UNIT1_CORE_CONCEPTS);
    const themeSet = new Set(IB_THEMATIC_STUDIES);
    const influenceRatingSet = new Set(INFLUENCE_RATINGS);
    const bannedFillerRegex = /\b(?:plays a crucial role|in today's complex world|it is important to note|underscores the complexity|highlights the multifaceted)\b/i;
    const assertSourceUrlsExist = (urls, validUrls, label) => {
        assert.ok(Array.isArray(urls) && urls.length > 0, `${label} needs at least one sourceUrl`);
        for (const url of urls) {
            assert.ok(validUrls.has(url), `${label} sourceUrl "${url}" must match a case source or supplementalSource`);
        }
    };
    const assertNoLongDirectQuotes = (text, label) => {
        for (const match of String(text || '').matchAll(/["“]([^"”]{12,})["”]/g)) {
            assert.ok(countWords(match[1]) <= 25, `${label} direct quote exceeds 25 words`);
        }
    };

    for (const item of CASE_STUDIES_2026.filter(entry => entry.briefingVersion === 2)) {
        const validUrls = new Set([
            ...item.sources.map(source => source.url),
            ...item.supplementalSources.map(source => source.url),
        ]);
        for (const loc of item.map.locations) {
            assertNonEmptyString(loc.role, `${item.id} v2 map location "${loc.label}" must document its role`);
        }

        assert.ok(Array.isArray(item.concepts) && item.concepts.length >= 1 && item.concepts.length <= 4, `${item.id} needs 1-4 concepts`);
        assert.equal(new Set(item.concepts).size, item.concepts.length, `${item.id} repeats a concept`);
        for (const concept of item.concepts) {
            assert.ok(conceptSet.has(concept), `${item.id} has unknown Unit 1 concept "${concept}"`);
        }

        assert.ok(Array.isArray(item.ibThemes) && item.ibThemes.length >= 1 && item.ibThemes.length <= 3, `${item.id} v2 case needs 1-3 ibThemes`);
        assert.equal(new Set(item.ibThemes).size, item.ibThemes.length, `${item.id} repeats an ibTheme`);
        for (const theme of item.ibThemes) {
            assert.ok(themeSet.has(theme), `${item.id} has unknown ibTheme "${theme}"`);
        }

        const orderedUniqueUrls = [];
        for (const src of [...item.sources, ...item.supplementalSources]) {
            if (src?.url && !orderedUniqueUrls.includes(src.url)) orderedUniqueUrls.push(src.url);
        }
        const totalSourceCount = orderedUniqueUrls.length;
        const memoClutterRegex = /\((?:Al Jazeera|CFR|Council on Foreign Relations|Human Rights Watch|HRW|Horn Diplomat|Associated Press|AP|PassBlue|UN News|Carnegie)[^)]*\)|\b(?:CFR notes|CFR adds|UN News summarizes|Horn Diplomat reported|PassBlue reports|HRW notes|HRW adds)\b/i;
        const assertValidMarkers = (text, label, requireAtLeastOne = false) => {
            const matches = [...String(text || '').matchAll(/\[\s*(\d+(?:\s*,\s*\d+)*)\s*\]/g)];
            if (requireAtLeastOne) {
                assert.ok(matches.length >= 1, `${label} must include numbered [n] source markers`);
            }
            for (const m of matches) {
                for (const token of m[1].split(',')) {
                    const num = Number.parseInt(token.trim(), 10);
                    assert.ok(num >= 1 && num <= totalSourceCount, `${label} source marker [${num}] out of range 1..${totalSourceCount}`);
                }
            }
        };

        for (const [idx, waypoint] of item.waypoints.entries()) {
            const paragraphs = String(waypoint.narration || '').trim().split(/\n\n+/).filter(Boolean);
            assert.equal(paragraphs.length, 2, `${item.id} step ${idx + 1} narration must have 2 paragraphs separated by blank line`);
            const words = countWords(waypoint.narration);
            assert.ok(words >= 90 && words <= 160, `${item.id} step ${idx + 1} narration has ${words} words (expected 90-160)`);
            assert.doesNotMatch(waypoint.narration, bannedFillerRegex, `${item.id} step ${idx + 1} uses banned filler phrasing`);
            assert.doesNotMatch(waypoint.narration, memoClutterRegex, `${item.id} step ${idx + 1} uses citation-dense memo scaffolding instead of numbered markers`);
            assertValidMarkers(waypoint.narration, `${item.id} step ${idx + 1}`, true);
            assertNoLongDirectQuotes(waypoint.narration, `${item.id} step ${idx + 1}`);
            if (waypoint.conceptInFocus) {
                assert.ok(conceptSet.has(waypoint.conceptInFocus), `${item.id} step ${idx + 1} invalid conceptInFocus`);
                assert.ok(item.concepts.includes(waypoint.conceptInFocus), `${item.id} step ${idx + 1} conceptInFocus absent from case.concepts`);
            }
            if (Array.isArray(item.timeline) && item.timeline.length > 0) {
                assertNonEmptyString(waypoint.relatedTimelineDate, `${item.id} v2 step ${idx + 1} must set relatedTimelineDate`);
                assert.ok(
                    item.timeline.some(t => t.date === waypoint.relatedTimelineDate),
                    `${item.id} step ${idx + 1} relatedTimelineDate "${waypoint.relatedTimelineDate}" must match a timeline event date`,
                );
            }
        }

        const bgParagraphs = String(item.background || '').trim().split(/\n\n+/).filter(Boolean);
        assert.ok(bgParagraphs.length >= 2, `${item.id} background must have at least 2 paragraphs`);
        const bgWords = countWords(item.background);
        assert.ok(bgWords >= 120 && bgWords <= 200, `${item.id} background has ${bgWords} words (expected 120-200)`);
        assert.doesNotMatch(item.background, bannedFillerRegex, `${item.id} background uses banned filler phrasing`);
        assert.doesNotMatch(item.background, memoClutterRegex, `${item.id} background uses citation-dense memo scaffolding instead of numbered markers`);
        assertValidMarkers(item.background, `${item.id} background`, true);
        assertNoLongDirectQuotes(item.background, `${item.id} background`);
        assertSourceUrlsExist(item.backgroundSources, validUrls, `${item.id} backgroundSources`);

        assert.ok(Array.isArray(item.keyTerms) && item.keyTerms.length >= 3 && item.keyTerms.length <= 6, `${item.id} needs 3-6 keyTerms`);
        for (const term of item.keyTerms) {
            assertNonEmptyString(term.term, `${item.id} keyTerm missing term`);
            assertNonEmptyString(term.definition, `${item.id} keyTerm "${term.term}" missing definition`);
            assert.ok(validUrls.has(term.sourceUrl), `${item.id} keyTerm "${term.term}" sourceUrl must match a case source`);
        }

        assert.ok(Array.isArray(item.debate) && item.debate.length >= 2 && item.debate.length <= 3, `${item.id} needs 2-3 debate pairs`);
        for (const pair of item.debate) {
            assertNonEmptyString(pair.claimBy, `${item.id} debate missing claimBy`);
            assertNonEmptyString(pair.claim, `${item.id} debate missing claim`);
            assertNonEmptyString(pair.counterBy, `${item.id} debate missing counterBy`);
            assertNonEmptyString(pair.counterClaim, `${item.id} debate missing counterClaim`);
            assertNoLongDirectQuotes(`${pair.claim} ${pair.counterClaim}`, `${item.id} debate`);
            assertSourceUrlsExist(pair.sourceUrls, validUrls, `${item.id} debate`);
        }

        assert.ok(Array.isArray(item.watchFor) && item.watchFor.length >= 2 && item.watchFor.length <= 4, `${item.id} needs 2-4 watchFor entries`);
        for (const entry of item.watchFor) {
            assertNonEmptyString(entry.date, `${item.id} watchFor missing date`);
            assertNonEmptyString(entry.indicator, `${item.id} watchFor missing indicator`);
            assert.ok(validUrls.has(entry.sourceUrl), `${item.id} watchFor sourceUrl must match a case source`);
        }

        assert.ok(Array.isArray(item.examPrompts) && item.examPrompts.length === 2, `${item.id} needs 2 examPrompts`);
        for (const prompt of item.examPrompts) {
            assertNonEmptyString(prompt, `${item.id} examPrompt cannot be empty`);
        }

        assert.ok(Array.isArray(item.influenceCheck) && item.influenceCheck.length === 3, `${item.id} needs 3 influenceCheck stages`);
        assert.deepEqual(item.influenceCheck.map(entry => entry.stage), [...INFLUENCE_CHECK_STAGES], `${item.id} influenceCheck stages must follow canonical order`);
        for (const stage of item.influenceCheck) {
            assert.ok(influenceRatingSet.has(stage.rating), `${item.id} influenceCheck stage "${stage.stage}" has invalid rating ${stage.rating}`);
            assertNonEmptyString(stage.evidence, `${item.id} influenceCheck stage "${stage.stage}" needs evidence`);
            assertSourceUrlsExist(stage.sourceUrls, validUrls, `${item.id} influenceCheck "${stage.stage}"`);
        }

        assert.ok(item.conceptLens && typeof item.conceptLens === 'object', `${item.id} needs conceptLens`);
        const lensEntries = Object.entries(item.conceptLens);
        assert.ok(lensEntries.length >= 1, `${item.id} conceptLens needs at least 1 concept`);
        for (const [key, value] of lensEntries) {
            assert.ok(['power', 'sovereignty', 'legitimacy', 'interdependence'].includes(key), `${item.id} unexpected conceptLens key "${key}"`);
            assertNonEmptyString(value, `${item.id} conceptLens.${key} cannot be empty`);
        }

        assert.ok(item.essayBuilder && typeof item.essayBuilder === 'object', `${item.id} needs essayBuilder`);
        assert.ok(item.examPrompts.includes(item.essayBuilder.prompt), `${item.id} essayBuilder.prompt must match an examPrompt`);
        for (const field of ['claim', 'evidence', 'counterClaim', 'judgment']) {
            assertNonEmptyString(item.essayBuilder[field], `${item.id} essayBuilder.${field} missing`);
        }
        assertSourceUrlsExist(item.essayBuilder.sourceUrls, validUrls, `${item.id} essayBuilder`);

        assert.ok(Array.isArray(item.timeline) && item.timeline.length >= 3 && item.timeline.length <= 6, `${item.id} needs 3-6 timeline events`);
        for (const event of item.timeline) {
            assertNonEmptyString(event.date, `${item.id} timeline missing date`);
            assertNonEmptyString(event.label, `${item.id} timeline missing label`);
            assert.ok(validUrls.has(event.sourceUrl), `${item.id} timeline sourceUrl must match a case source`);
        }

        if (Array.isArray(item.keyFigures)) {
            assert.ok(item.keyFigures.length <= 3, `${item.id} keyFigures capped at 3`);
            const baseMetricsText = `${item.statusSummary} ${item.uncertainty}`;
            for (const figure of item.keyFigures) {
                assertNonEmptyString(figure.value, `${item.id} keyFigure missing value`);
                assertNonEmptyString(figure.label, `${item.id} keyFigure missing label`);
                assertNonEmptyString(figure.asOf, `${item.id} keyFigure missing asOf`);
                assert.ok(validUrls.has(figure.sourceUrl), `${item.id} keyFigure sourceUrl must match a case source`);
                assert.ok(baseMetricsText.includes(String(figure.value)), `${item.id} keyFigure value "${figure.value}" must appear verbatim in statusSummary/uncertainty`);
            }
        }

        const times = computeBriefingReadingTimes(item);
        assert.ok(times.fullMinutes >= times.quickMinutes && times.quickMinutes >= 1);
    }
});
