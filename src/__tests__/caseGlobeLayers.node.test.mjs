import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildCaseArcs,
    buildCaseRings,
    buildConflictCasePairs,
    caseLocationPairs,
    hexToRgba,
} from '../globe/caseGlobeLayers.mjs';
import { CASE_STUDIES_2026 } from '../cases/index.mjs';
import { toForecastRecord } from '../cases/schema.mjs';

const loc = (label, latitude, longitude) => ({ label, latitude, longitude, role: `${label} role` });
const fixture = (overrides = {}) => ({
    isCaseStudy: true,
    caseStudyId: 'fixture',
    'Entity/Subject': 'Fixture case',
    Broad_Category: 'Geopolitics & Conflict',
    reviewBy: '2099-01-01',
    map: { mode: 'regional', locations: [loc('A', 0, 0), loc('B', 10, 10), loc('C', 20, 20)] },
    ...overrides,
});

test('regional cases connect hub-and-spoke from the primary location', () => {
    const pairs = caseLocationPairs(fixture());
    assert.deepEqual(pairs.map(([a, b]) => `${a.label}-${b.label}`), ['A-B', 'A-C']);
});

test('route cases connect locations in sequence', () => {
    const pairs = caseLocationPairs(fixture({ map: { mode: 'route', locations: [loc('A', 0, 0), loc('B', 1, 1), loc('C', 2, 2)] } }));
    assert.deepEqual(pairs.map(([a, b]) => `${a.label}-${b.label}`), ['A-B', 'B-C']);
});

test('global and point cases produce no arcs', () => {
    assert.equal(caseLocationPairs(fixture({ map: { mode: 'global', locations: [loc('A', 0, 0), loc('B', 1, 1)] } })).length, 0);
    assert.equal(caseLocationPairs(fixture({ map: { mode: 'point', locations: [loc('A', 0, 0)] } })).length, 0);
});

test('arcs only ever join two locations of the same case', () => {
    const items = CASE_STUDIES_2026.map(toForecastRecord);
    const arcs = buildCaseArcs(items);
    assert.ok(arcs.length > 0, 'expected at least one mapped case arc');
    for (const arc of arcs) {
        const owner = items.find(item => item.caseStudyId === arc.caseStudyId);
        const coords = owner.map.locations.map(l => `${Number(l.latitude)},${Number(l.longitude)}`);
        assert.ok(coords.includes(`${arc.startLat},${arc.startLng}`), `${arc.caseStudyId} start not in its own map`);
        assert.ok(coords.includes(`${arc.endLat},${arc.endLng}`), `${arc.caseStudyId} end not in its own map`);
        assert.notEqual(owner.map.mode, 'global');
    }
});

test('archived and non-case items are excluded from rings and arcs', () => {
    const items = [fixture({ status: 'archived' }), { isCaseStudy: false, map: fixture().map }];
    assert.equal(buildCaseRings(items).length, 0);
    assert.equal(buildCaseArcs(items).length, 0);
});

test('overdue cases pulse slower and smaller than current cases', () => {
    const [current] = buildCaseRings([fixture()], '2026-11-17');
    const [overdue] = buildCaseRings([fixture({ reviewBy: '2026-01-01' })], '2026-11-17');
    const [inProgress] = buildCaseRings([fixture({ reviewStatus: 'update-in-progress' })], '2026-11-17');
    assert.equal(current.overdue, false);
    assert.equal(overdue.overdue, true);
    assert.equal(inProgress.overdue, true);
    assert.ok(overdue.repeatPeriod > current.repeatPeriod);
    assert.ok(overdue.maxRadius < current.maxRadius);
});

test('conflict pair rows come only from conflict-category case arcs', () => {
    const arcs = buildCaseArcs([fixture(), fixture({ caseStudyId: 'econ', Broad_Category: 'Economy & Trade' })]);
    const pairs = buildConflictCasePairs(arcs);
    assert.equal(pairs.length, 2);
    assert.ok(pairs.every(pair => pair.caseTitle === 'Fixture case'));
});

test('hexToRgba handles short, long and invalid colors', () => {
    assert.equal(hexToRgba('#fff', 0.5), 'rgba(255, 255, 255, 0.5)');
    assert.equal(hexToRgba('#ff0066', 1), 'rgba(255, 0, 102, 1)');
    assert.match(hexToRgba('nope', 0.2), /^rgba\(182, 156, 255, 0\.2\)$/);
});

test('locator labels stay inside the frame and avoid each other when space allows', async () => {
    const { placeLabels } = await import('../components/locatorLabels.mjs');
    const points = [
        { label: 'Sana\'a', x: 200, y: 120 },
        { label: 'Hudaydah', x: 190, y: 128 },
        { label: 'Aden', x: 205, y: 140 },
        { label: 'Cape Town, South Africa', x: 350, y: 200 },
    ];
    const labels = placeLabels(points, 360, 260);
    const boxes = labels.map(l => {
        const w = l.text.length * 5.7;
        const x0 = l.anchor === 'start' ? l.x : l.anchor === 'end' ? l.x - w : l.x - w / 2;
        return { x0, x1: x0 + w, y0: l.y - 9, y1: l.y + 2 };
    });
    for (const b of boxes) {
        assert.ok(b.x0 >= 4 && b.x1 <= 356, 'label must stay inside the frame');
    }
    const overlaps = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
    for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
            assert.ok(!overlaps(boxes[i], boxes[j]), `labels ${labels[i].text} and ${labels[j].text} overlap`);
        }
    }

    const [longLabel] = placeLabels([{ label: 'Very Long Border Settlement Beyond Limit', x: 180, y: 120 }], 360, 260);
    assert.equal(longLabel.fullText, 'Very Long Border Settlement Beyond Limit');
    assert.ok(longLabel.text.length <= 24);
    assert.ok(longLabel.text.endsWith('…'));
});

test('case arcs assign deterministic initialGap in [0, 1)', () => {
    const first = buildCaseArcs([fixture()]);
    const second = buildCaseArcs([fixture()]);
    assert.deepEqual(first.map(a => a.initialGap), second.map(a => a.initialGap));
    for (const arc of first) {
        assert.ok(Number.isFinite(arc.initialGap) && arc.initialGap >= 0 && arc.initialGap < 1);
    }
});
