const test = require('node:test');
const assert = require('node:assert/strict');

const {
    FIXED_QUERIES,
    SOURCE_ROLE_LABELS,
    TARGET_ISSUES,
    TARGET_REGIONS,
    TARGET_SOURCE_ROLES,
    assessArticle,
    buildPublicSnapshot,
    dedupeArticles,
    selectDiverseArticles,
    withSnapshotAge,
} = require('../_shared/intel-snapshot');

test('public snapshot uses fixed balanced queries and never accepts a visitor query', () => {
    assert.equal(FIXED_QUERIES.length, 8);
    assert.match(FIXED_QUERIES.map(item => item.query).join(' '), /diplomacy/i);
    assert.match(FIXED_QUERIES.map(item => item.query).join(' '), /Global South/i);
    assert.match(FIXED_QUERIES.map(item => item.query).join(' '), /climate/i);
    assert.match(FIXED_QUERIES.map(item => item.query).join(' '), /human rights/i);
    assert.deepEqual([...new Set(FIXED_QUERIES.map(item => item.region))], TARGET_REGIONS);
    assert.equal(FIXED_QUERIES.every(item => item.results === 7), true);
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
    assert.equal(snapshot.items[0].coverage.region, 'Asia-Pacific');
    assert.equal(snapshot.items[0].coverage.issue, 'Health & Human Security');
    assert.match(snapshot.items[0].coverage.selectionReason, /automated relevance score/i);
    assert.equal(snapshot.meta.status, 'fresh');
    assert.equal(snapshot.meta.queryCount, 8);
    assert.equal(snapshot.meta.coverage.policy, 'relevance-diversity-v1');
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

test('promotional and weakly relevant discovery results are rejected', () => {
    const query = FIXED_QUERIES[0];
    const promotional = assessArticle({
        title: 'Mid-month funding opportunities newsletter',
        snippet: 'Apply now for grants and event registrations.',
        source: 'Promotional List',
        date: '1 day ago',
        link: 'https://example.org/funding',
    }, query);
    const unrelated = assessArticle({
        title: 'Summer product collection arrives',
        snippet: 'A retailer announces its latest seasonal product collection.',
        source: 'Example Store',
        date: '1 day ago',
        link: 'https://example.org/products',
    }, query);

    assert.equal(promotional, null);
    assert.equal(unrelated, null);
});

test('query region breaks ambiguous geographic ties without overriding stronger named-place evidence', () => {
    const menaQuery = FIXED_QUERIES.find(query => query.id === 'mena-diplomacy-human-security');
    const northAfrica = assessArticle({
        title: 'North Africa diplomacy addresses humanitarian displacement',
        snippet: 'Regional governments discuss migration, rights, aid access, and development.',
        source: 'Al Jazeera',
        date: '2 hours ago',
        link: 'https://www.aljazeera.com/preview-north-africa',
    }, menaQuery);
    const explicitSudan = assessArticle({
        title: 'Sudan peace talks address humanitarian displacement',
        snippet: 'African regional institutions discuss migration, security, and aid access.',
        source: 'Al Jazeera',
        date: '2 hours ago',
        link: 'https://www.aljazeera.com/preview-sudan',
    }, menaQuery);

    assert.equal(northAfrica.coverage.region, 'Middle East & North Africa');
    assert.equal(explicitSudan.coverage.region, 'Africa');
});

test('repeated coverage of one named event is capped even when issue labels differ', () => {
    const candidates = TARGET_ISSUES.slice(0, 5).map((issue, index) => ({
        url: `https://publisher-${index}.example.org/iran-${index}`,
        'Entity/Subject': `Iran regional development ${index}`,
        coverage: {
            region: 'Middle East & North Africa',
            issue,
            sourceRole: 'research',
            sourceRoleLabel: SOURCE_ROLE_LABELS.research,
            relevanceScore: 90 - index,
        },
        _publisherDomain: `publisher-${index}.example.org`,
        _topicCluster: 'Middle East & North Africa:iran',
    }));

    assert.equal(selectDiverseArticles(candidates).length, 2);
});

test('selection balances regions and issues while limiting publishers, clusters, and discovery sources', () => {
    const candidates = [];
    let index = 0;
    for (const [regionIndex, region] of TARGET_REGIONS.entries()) {
        for (let offset = 0; offset < 3; offset += 1) {
            const issue = TARGET_ISSUES[(regionIndex + offset) % TARGET_ISSUES.length];
            const role = offset === 2 ? 'discovery' : (offset === 1 ? 'research' : 'regional');
            const domain = offset === 0 && regionIndex < 3 ? 'shared.example.org' : `source-${regionIndex}-${offset}.example.org`;
            candidates.push({
                url: `https://${domain}/story-${index}`,
                'Entity/Subject': `Relevant global politics story ${index}`,
                coverage: {
                    region,
                    issue,
                    sourceRole: role,
                    sourceRoleLabel: SOURCE_ROLE_LABELS[role],
                    relevanceScore: 100 - index,
                },
                _publisherDomain: domain,
                _topicCluster: offset < 2 ? `${region}:${issue}:shared-event` : `${region}:${issue}:event-${index}`,
            });
            index += 1;
        }
    }

    const selected = selectDiverseArticles(candidates);
    const counts = (field) => selected.reduce((result, item) => {
        const key = item.coverage[field];
        result[key] = (result[key] || 0) + 1;
        return result;
    }, {});
    const domainCounts = selected.reduce((result, item) => {
        const domain = new URL(item.url).hostname;
        result[domain] = (result[domain] || 0) + 1;
        return result;
    }, {});

    assert.equal(selected.length <= 20, true);
    assert.deepEqual(Object.keys(counts('region')).sort(), [...TARGET_REGIONS].sort());
    assert.deepEqual(Object.keys(counts('issue')).sort(), [...TARGET_ISSUES].sort());
    assert.equal(Math.max(...Object.values(counts('region'))) <= 4, true);
    assert.equal(Math.max(...Object.values(counts('issue'))) <= 4, true);
    assert.equal(Math.max(...Object.values(domainCounts)) <= 2, true);
    assert.deepEqual(
        TARGET_SOURCE_ROLES.filter(role => selected.some(item => item.coverage.sourceRole === role)),
        ['regional', 'research'],
    );
    assert.equal(Math.max(...Object.values(counts('sourceRole'))) <= 8, true);
    assert.equal(selected.filter(item => item.coverage.sourceRole === 'discovery').length <= 4, true);
    assert.equal(selected.every(item => !('_publisherDomain' in item) && !('_topicCluster' in item)), true);
});
