const test = require('node:test');
const assert = require('node:assert/strict');

const { FIXED_QUERIES, buildPublicSnapshot, dedupeArticles, withSnapshotAge } = require('../_shared/intel-snapshot');

test('public snapshot uses fixed balanced queries and never accepts a visitor query', () => {
    assert.equal(FIXED_QUERIES.length, 4);
    assert.match(FIXED_QUERIES.map(item => item.query).join(' '), /diplomacy/i);
    assert.match(FIXED_QUERIES.map(item => item.query).join(' '), /Global South/i);
    assert.match(FIXED_QUERIES.map(item => item.query).join(' '), /climate/i);
    assert.match(FIXED_QUERIES.map(item => item.query).join(' '), /human rights/i);
    assert.equal(FIXED_QUERIES.some(item => 'visitorQuery' in item), false);
});

test('public snapshot reports not-configured without exposing or requiring a key', async () => {
    const snapshot = await buildPublicSnapshot({ apiKey: '', now: new Date('2026-08-09T00:00:00Z') });

    assert.deepEqual(snapshot.items, []);
    assert.equal(snapshot.meta.status, 'not-configured');
    assert.equal(snapshot.meta.sourceMode, 'public-cache');
});

test('public snapshot normalizes, deduplicates, and labels cached provider results', async () => {
    const fetchImpl = async () => ({
        ok: true,
        json: async () => ({
            news: [{
                title: 'Myanmar humanitarian access remains constrained',
                snippet: 'Humanitarian access and displacement across Myanmar remain central concerns.',
                source: 'Example News',
                date: '2 hours ago',
                link: 'https://example.org/myanmar?utm_source=test',
            }],
        }),
    });
    const snapshot = await buildPublicSnapshot({
        apiKey: 'server-only-key',
        fetchImpl,
        now: new Date('2026-08-09T00:00:00Z'),
    });

    assert.equal(snapshot.items.length, 1);
    assert.equal(snapshot.items[0]._scraperSource, 'serper-public-cache');
    assert.equal(snapshot.items[0].url, 'https://example.org/myanmar');
    assert.equal(snapshot.meta.status, 'fresh');
    assert.equal(snapshot.meta.queryCount, 4);
    assert.equal(withSnapshotAge(snapshot, new Date('2026-08-09T02:00:00Z').getTime()).meta.status, 'stale');
});

test('duplicate URLs and duplicate headlines are each collapsed', () => {
    const base = { url: 'https://example.org/one', 'Entity/Subject': 'Shared headline' };
    assert.equal(dedupeArticles([
        base,
        { ...base },
        { url: 'https://example.org/two', 'Entity/Subject': ' shared   headline ' },
    ]).length, 1);
});
