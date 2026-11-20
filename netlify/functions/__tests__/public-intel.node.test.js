const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
    FIXED_QUERIES,
    SNAPSHOT_TTL_MS,
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

const {
    INSTITUTIONAL_RSS_FEEDS,
    decodeXmlEntities,
    fetchReliefWebReports,
    isFreshAndConsistentDate,
    parseRssItems,
} = require('../_shared/free-feeds');

test('free-feeds parses RSS CDATA, entities, ISO dates, guid fallback, rejects non-HTTPS links, enforces 30-day freshness, and rejects URL/pubDate mismatches', async () => {
    const fixedNow = new Date('2026-11-20T00:00:00Z');
    const xml = `<?xml version="1.0" encoding="utf-8"?>
        <rss version="2.0"><channel>
            <item>
                <title>Trade &amp; Diplomacy: a &lt; b and c &gt; d &#x2014; update</title>
                <link>https://news.un.org/en/story/2026/11/1200010</link>
                <description><![CDATA[<p>UN delegates discussed <b>humanitarian</b> aid &amp;amp; treaties.</p>]]></description>
                <pubDate>Thu, 19 Nov 2026 04:00:00 +0000</pubDate>
            </item>
            <item>
                <title>Bad javascript link</title>
                <link>javascript:alert(1)</link>
                <description>Should be dropped.</description>
                <pubDate>Thu, 19 Nov 2026 04:00:00 +0000</pubDate>
            </item>
            <item>
                <title>Plain HTTP link</title>
                <link>http://example.org/insecure</link>
                <description>Should be dropped.</description>
                <pubDate>Thu, 19 Nov 2026 04:00:00 +0000</pubDate>
            </item>
            <item>
                <title>Missing pubDate item</title>
                <link>https://news.un.org/en/story/2026/11/1200012</link>
                <description>Should be dropped because pubDate is missing.</description>
            </item>
            <item>
                <title>Stale 2020 COVID package</title>
                <link>https://www.who.int/news/item/12-08-2020-stale</link>
                <description>Older than 30 days.</description>
                <pubDate>Wed, 12 Aug 2020 10:00:00 GMT</pubDate>
            </item>
            <item>
                <title>URL date disagrees with pubDate</title>
                <link>https://www.who.int/news/item/05-10-2020-mental-health</link>
                <description>Stale URL republished with recent pubDate.</description>
                <pubDate>Thu, 19 Nov 2026 04:00:00 +0000</pubDate>
            </item>
            <item>
                <title>GUID fallback item</title>
                <guid>https://news.un.org/en/story/2026/11/1200099</guid>
                <description>Valid https guid fallback.</description>
                <pubDate>Wed, 18 Nov 2026 12:00:00 +0000</pubDate>
            </item>
            <item>
                <title>Exceeds maxItems cap</title>
                <link>https://news.un.org/en/story/2026/11/1200011</link>
                <description>Should be capped.</description>
                <pubDate>Thu, 19 Nov 2026 04:00:00 +0000</pubDate>
            </item>
        </channel></rss>`;
    const items = parseRssItems(xml, { sourceName: 'UN News', maxItems: 2, now: fixedNow });
    assert.equal(items.length, 2);
    assert.equal(items[0].title, 'Trade & Diplomacy: a < b and c > d — update');
    assert.equal(items[0].snippet, 'UN delegates discussed humanitarian aid &amp; treaties.');
    assert.equal(items[0].date, '2026-11-19');
    assert.equal(items[1].link, 'https://news.un.org/en/story/2026/11/1200099');
    assert.equal(decodeXmlEntities('a &lt; b &gt; c &amp; d'), 'a < b > c & d');

    // Direct freshness & URL/pubDate drift checks
    assert.equal(isFreshAndConsistentDate('2026-11-10', 'https://news.un.org/en/story/2026/11/123', { now: fixedNow }), true);
    assert.equal(isFreshAndConsistentDate('2026-10-01', 'https://news.un.org/en/story/2026/10/123', { now: fixedNow }), false, 'Items older than 30 days must be rejected');
    assert.equal(isFreshAndConsistentDate('2026-11-19', 'https://example.org/2020/08/old-report', { now: fixedNow }), false, 'URL date disagreeing by >30 days must be rejected');
    assert.equal(isFreshAndConsistentDate('not-a-date', 'https://news.un.org/en/story/2026/11/123', { now: fixedNow }), false, 'Unparseable date must be rejected');

    // Confirm stale WHO RSS feed is removed
    assert.equal(INSTITUTIONAL_RSS_FEEDS.some(f => f.url.includes('who.int/rss-feeds/news-english.xml')), false);

    const skippedRw = await fetchReliefWebReports(async () => {
        throw new Error('Should not fetch when appname is empty');
    }, { appname: '' });
    assert.equal(skippedRw.status, 'skipped-no-appname');
    assert.deepEqual(skippedRw.items, []);
});

test('public snapshot builds live institutional feed with zero SERPER_API_KEY and pauses Serper when key exists but flag is off', async () => {
    const calledUrls = [];
    const sampleRss = `<?xml version="1.0" encoding="utf-8"?>
        <rss version="2.0"><channel>
            <item>
                <title>UN Security Council addresses Sudan humanitarian access and ceasefire talks</title>
                <link>https://news.un.org/en/story/2026/11/1200001</link>
                <description><![CDATA[United Nations officials report worsening displacement and diplomatic efforts in Sudan.]]></description>
                <pubDate>Thu, 19 Nov 2026 04:00:00 +0000</pubDate>
            </item>
        </channel></rss>`;
    const fetchImpl = async (url) => {
        calledUrls.push(String(url));
        if (String(url).includes('google.serper.dev')) {
            throw new Error('Serper must not be called when paused');
        }
        if (String(url).includes('reliefweb.int')) {
            return {
                ok: true,
                json: async () => ({
                    data: [{
                        fields: {
                            title: 'Myanmar humanitarian displacement and aid access report',
                            url: 'https://reliefweb.int/report/myanmar/sample-2026',
                            date: { created: '2026-11-19T02:00:00+00:00' },
                            primary_country: { name: 'Myanmar' },
                            source: [{ name: 'OCHA' }],
                            theme: [{ name: 'Protection and Human Rights' }],
                        },
                    }],
                }),
            };
        }
        if (String(url).includes('gdeltproject.org')) {
            return {
                ok: true,
                json: async () => ({
                    articles: [{
                        title: 'ASEAN ministers discuss South China Sea maritime diplomacy',
                        url: 'https://www.aljazeera.com/news/2026/11/19/asean-maritime-diplomacy',
                        domain: 'aljazeera.com',
                        seendate: '20261119T030000Z',
                    }],
                }),
            };
        }
        return { ok: true, text: async () => sampleRss };
    };

    const snapshot = await buildPublicSnapshot({
        apiKey: 'existing-key-but-paused',
        enableSerper: false,
        reliefwebAppname: 'gcc-test-app',
        fetchImpl,
        now: new Date('2026-11-19T05:00:00Z'),
    });

    assert.equal(snapshot.meta.status, 'fresh');
    assert.equal(snapshot.meta.errorCode, undefined);
    assert.equal('serperStatus' in snapshot.meta, false, 'Public meta must not expose billing state');
    assert.equal(snapshot.items.length, 3);
    assert.equal(calledUrls.some(u => u.includes('google.serper.dev')), false);
    assert.match(snapshot.meta.provider, /UN News RSS/);
    assert.match(snapshot.meta.provider, /ReliefWeb/);
    assert.match(snapshot.meta.provider, /GDELT/);
    assert.deepEqual(
        snapshot.meta.providerResults.map(r => [r.provider, r.status]),
        [['UN News RSS', 'ok'], ['ReliefWeb', 'ok'], ['GDELT', 'ok']]
    );
});

test('public snapshot keeps free institutional items and avoids error when optional Serper runs out of credits', async () => {
    let serperCalls = 0;
    const sampleRss = `<?xml version="1.0" encoding="utf-8"?>
        <rss version="2.0"><channel>
            <item>
                <title>Climate finance treaty talks open for Pacific island states</title>
                <link>https://news.un.org/en/story/2026/11/1200002</link>
                <description>United Nations climate and ocean governance talks highlight Pacific resilience.</description>
                <pubDate>Thu, 19 Nov 2026 04:00:00 +0000</pubDate>
            </item>
        </channel></rss>`;
    const snapshot = await buildPublicSnapshot({
        apiKey: 'exhausted-key',
        enableSerper: true,
        fetchImpl: async (url) => {
            if (String(url).includes('google.serper.dev')) {
                serperCalls += 1;
                return { ok: false, status: 400, json: async () => ({ message: 'Not enough credits' }) };
            }
            if (String(url).includes('gdeltproject.org')) {
                return { ok: false, status: 429 };
            }
            return { ok: true, text: async () => sampleRss };
        },
        now: new Date('2026-11-19T05:00:00Z'),
    });

    assert.equal(serperCalls, 8);
    assert.equal(snapshot.meta.status, 'fresh');
    assert.equal(snapshot.meta.failedQueryCount, 9, 'failedQueryCount must honestly count both GDELT and Serper failures');
    assert.equal(snapshot.meta.errorCode, undefined);
    assert.equal(snapshot.items.length, 1);
    assert.equal(snapshot.meta.providerResults.find(r => r.provider === 'GDELT')?.status, 'failed');
    assert.equal(snapshot.meta.providerResults.find(r => r.provider === 'Serper')?.status, 'failed');
});

test('public snapshot marks partial when some core RSS feeds fail and sets errorCode when all fail', async () => {
    let rssCalls = 0;
    const sampleRss = `<?xml version="1.0" encoding="utf-8"?>
        <rss version="2.0"><channel>
            <item>
                <title>UN Security Council addresses Sudan humanitarian access</title>
                <link>https://news.un.org/en/story/2026/11/1200099</link>
                <description>United Nations officials report worsening displacement in Sudan.</description>
                <pubDate>Thu, 19 Nov 2026 04:00:00 +0000</pubDate>
            </item>
        </channel></rss>`;
    const partial = await buildPublicSnapshot({
        apiKey: '',
        fetchImpl: async (url) => {
            if (String(url).includes('gdeltproject.org')) return { ok: false, status: 429 };
            rssCalls += 1;
            if (rssCalls === 1) return { ok: true, text: async () => sampleRss };
            return { ok: false, status: 503 };
        },
        now: new Date('2026-11-19T05:00:00Z'),
    });
    assert.equal(partial.meta.status, 'partial');
    assert.equal(partial.items.length, 1);

    const allFailed = await buildPublicSnapshot({
        apiKey: '',
        fetchImpl: async () => ({ ok: false, status: 503 }),
        now: new Date('2026-11-19T05:00:00Z'),
    });
    assert.equal(allFailed.meta.status, 'provider-error');
    assert.equal(allFailed.meta.errorCode, 'upstream-error');
});

test('public snapshot reports not-configured without exposing or requiring a key when free feeds are disabled', async () => {
    const snapshot = await buildPublicSnapshot({ apiKey: '', includeFreeFeeds: false, now: new Date('2026-08-09T00:00:00Z') });

    assert.deepEqual(snapshot.items, []);
    assert.equal(snapshot.meta.status, 'not-configured');
    assert.equal(snapshot.meta.sourceMode, 'public-cache');
    assert.equal(snapshot.meta.errorCode, undefined);
});

test('public snapshot classifies Serper credit exhaustion, invalid API keys, empty results, and timeouts without leaking credentials', async () => {
    const secretKey = 'super-secret-serper-token-do-not-leak';
    const creditFailSnapshot = await buildPublicSnapshot({
        apiKey: secretKey,
        enableSerper: true,
        includeFreeFeeds: false,
        fetchImpl: async () => ({
            ok: false,
            status: 400,
            json: async () => ({ message: 'Not enough credits', statusCode: 400 }),
        }),
        now: new Date('2026-11-18T00:00:00Z'),
    });
    assert.equal(creditFailSnapshot.meta.status, 'provider-error');
    assert.equal(creditFailSnapshot.meta.failedQueryCount, 8);
    assert.equal(creditFailSnapshot.meta.errorCode, 'credits-exhausted');
    assert.equal(creditFailSnapshot.meta.providerHttpStatus, 400);
    assert.ok(!JSON.stringify(creditFailSnapshot).includes(secretKey), 'Snapshot must never include SERPER_API_KEY');

    const authFailSnapshot = await buildPublicSnapshot({
        apiKey: secretKey,
        enableSerper: true,
        includeFreeFeeds: false,
        fetchImpl: async () => ({
            ok: false,
            status: 403,
            json: async () => ({ message: 'Unauthorized.', statusCode: 403 }),
        }),
        now: new Date('2026-11-18T00:00:00Z'),
    });
    assert.equal(authFailSnapshot.meta.status, 'provider-error');
    assert.equal(authFailSnapshot.meta.errorCode, 'invalid-api-key');
    assert.equal(authFailSnapshot.meta.providerHttpStatus, 403);
    assert.ok(!JSON.stringify(authFailSnapshot).includes(secretKey), 'Snapshot must never include SERPER_API_KEY');

    const emptyQualifyingSnapshot = await buildPublicSnapshot({
        apiKey: secretKey,
        enableSerper: true,
        includeFreeFeeds: false,
        fetchImpl: async () => ({
            ok: true,
            json: async () => ({ news: [{ title: 'Summer shoe collection', snippet: 'Fashion promo', link: 'https://example.org/shoes' }] }),
        }),
        now: new Date('2026-11-18T00:00:00Z'),
    });
    assert.equal(emptyQualifyingSnapshot.meta.status, 'empty');
    assert.equal(emptyQualifyingSnapshot.meta.failedQueryCount, 0);
    assert.equal(emptyQualifyingSnapshot.meta.errorCode, undefined);

    const timeoutSnapshot = await buildPublicSnapshot({
        apiKey: secretKey,
        enableSerper: true,
        includeFreeFeeds: false,
        fetchImpl: async () => {
            const err = new Error('aborted');
            err.name = 'AbortError';
            throw err;
        },
        now: new Date('2026-11-18T00:00:00Z'),
    });
    assert.equal(timeoutSnapshot.meta.status, 'provider-error');
    assert.equal(timeoutSnapshot.meta.errorCode, 'timeout');
    assert.ok(!JSON.stringify(timeoutSnapshot).includes(secretKey));
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
        enableSerper: true,
        includeFreeFeeds: false,
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
    assert.equal(withSnapshotAge(snapshot, new Date('2026-08-09T02:00:00Z').getTime()).meta.status, 'fresh');
    assert.equal(withSnapshotAge(snapshot, new Date('2026-08-09T13:00:00Z').getTime()).meta.status, 'stale');

    const netlifyToml = fs.readFileSync(path.join(__dirname, '../../../netlify.toml'), 'utf8');
    assert.match(netlifyToml, /\[functions\."refresh-public-intel"\]\s+schedule\s*=\s*"0 \*\/6 \* \* \*"/);
    assert.equal(SNAPSHOT_TTL_MS, 6 * 60 * 60 * 1000);
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

test('shared intel-normalization coordinate inference is deterministic and categorizeSector uses word-bounded Governance & Rights matching', () => {
    const { getCoords, resolveCoords, categorizeSector } = require('../_shared/intel-normalization');
    assert.deepEqual(
        getCoords('Diplomatic talks involving Ukraine'),
        getCoords('Diplomatic talks involving Ukraine')
    );
    assert.equal(categorizeSector('National human rights commission reviews indigenous constitutional referendum'), 'Governance & Rights');
    assert.equal(categorizeSector('Parliamentary elections scheduled after judicial ruling'), 'Governance & Rights');
    assert.notEqual(categorizeSector('Data selection methodology in quarterly commodity market report'), 'Governance & Rights', '"selection" must not match "election"');
    assert.equal(categorizeSector('Data selection methodology in quarterly commodity market report'), 'Economy & Trade');

    // Required whole-word & specificity coordinate regressions
    const sudan = resolveCoords('Sudan hunger crisis deepens as funding cuts bite', 'UN agencies warn of famine');
    assert.equal(sudan.matchedPlace, 'sudan');
    assert.equal(sudan.precision, 'named-place');
    assert.deepEqual(sudan.coords, [12.9, 30.2]);

    const myanmar = resolveCoords('Myanmar junta announces election', 'UN unrest warning');
    assert.equal(myanmar.matchedPlace, 'myanmar');
    assert.equal(myanmar.precision, 'named-place');
    assert.deepEqual(myanmar.coords, [19.2, 96.7]);

    const pakistan = resolveCoords('Thousands flee floods in Pakistan', 'Relief efforts continue');
    assert.equal(pakistan.matchedPlace, 'pakistan');
    assert.deepEqual(pakistan.coords, [30.4, 69.3]);

    const colombia = resolveCoords('Senator backs Colombia peace deal', 'Regional talks');
    assert.equal(colombia.matchedPlace, 'colombia');
    assert.deepEqual(colombia.coords, [4.6, -74.1]);

    const centralAmerica = resolveCoords('When the rains fail: Preparing for drought in Central America', 'UN climate resilience');
    assert.equal(centralAmerica.matchedPlace, 'central america');
    assert.notDeepEqual(centralAmerica.coords, [37.1, -95.6], 'Central America must never pin in Kansas/USA');
    assert.deepEqual(centralAmerica.coords, [13.8, -86.2]);

    // "un" must never pin a story to New York, and unmapped global items return null coords
    const unOnly = resolveCoords('UN report warns of global unrest and funding gaps', 'United Nations appeal');
    assert.equal(unOnly.precision, 'fallback');
    assert.equal(unOnly.matchedPlace, null);
    assert.equal(unOnly.coords, null);

    // Earliest-named place in title wins (longest match breaks exact index ties)
    const gazaTalks = resolveCoords('Gaza ceasefire talks in Egypt', 'Regional mediation continues');
    assert.equal(gazaTalks.matchedPlace, 'gaza');
    assert.deepEqual(gazaTalks.coords, [31.5, 34.5]);

    const omanTalks = resolveCoords('Oman mediates Iran talks', 'Diplomats meet in Muscat');
    assert.equal(omanTalks.matchedPlace, 'oman');
    assert.deepEqual(omanTalks.coords, [21.5, 55.9]);

    const southSudan = resolveCoords('South Sudan peace deal signed in Sudan', 'UN peacekeeping update');
    assert.equal(southSudan.matchedPlace, 'south sudan');
    assert.deepEqual(southSudan.coords, [6.9, 31.3]);

    const guineaBissau = resolveCoords('Guinea-Bissau holds parliamentary vote', 'West Africa election update');
    assert.equal(guineaBissau.matchedPlace, 'guinea-bissau');
    assert.deepEqual(guineaBissau.coords, [11.8, -15.2]);

    const eqGuinea = resolveCoords('Equatorial Guinea signs energy deal', 'Central Africa economic update');
    assert.equal(eqGuinea.matchedPlace, 'equatorial guinea');
    assert.deepEqual(eqGuinea.coords, [1.65, 10.27]);

    const lesotho = resolveCoords('Lesotho highland water treaty enters new phase', 'Southern Africa cooperation');
    assert.equal(lesotho.matchedPlace, 'lesotho');
    assert.deepEqual(lesotho.coords, [-29.6, 28.2]);

    const romania = resolveCoords('Romania energy security bill passes parliament', 'Black Sea corridor update');
    assert.equal(romania.matchedPlace, 'romania');
    assert.deepEqual(romania.coords, [45.9, 25.0]);

    // False-positive guards on ordinary English words & lowercase pronoun "us"
    const noMischief = resolveCoords('Political mischief in parliamentary policy debate', 'Domestic politics');
    assert.equal(noMischief.matchedPlace, null);
    const noPronounUs = resolveCoords('Join us for global climate talks today', 'Multilateral delegates meet');
    assert.equal(noPronounUs.matchedPlace, null);
    const upperUs = resolveCoords('US sanctions target illicit finance networks', 'Treasury announcement');
    assert.equal(upperUs.matchedPlace, 'united states');

    // All 193 UN member states + observer states & case locations resolve deterministically
    const UN_MEMBER_STATES_193 = [
        'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Antigua and Barbuda', 'Argentina',
        'Armenia', 'Australia', 'Austria', 'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados',
        'Belarus', 'Belgium', 'Belize', 'Benin', 'Bhutan', 'Bolivia', 'Bosnia and Herzegovina', 'Botswana',
        'Brazil', 'Brunei', 'Bulgaria', 'Burkina Faso', 'Burundi', 'Cabo Verde', 'Cambodia', 'Cameroon',
        'Canada', 'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia', 'Comoros',
        'Republic of the Congo', 'Costa Rica', "Côte d'Ivoire", 'Croatia', 'Cuba', 'Cyprus', 'Czechia',
        'Democratic Republic of the Congo', 'Denmark', 'Djibouti', 'Dominica', 'Dominican Republic',
        'Ecuador', 'Egypt', 'El Salvador', 'Equatorial Guinea', 'Eritrea', 'Estonia', 'Eswatini',
        'Ethiopia', 'Fiji', 'Finland', 'France', 'Gabon', 'Gambia', 'Georgia', 'Germany', 'Ghana',
        'Greece', 'Grenada', 'Guatemala', 'Guinea', 'Guinea-Bissau', 'Guyana', 'Haiti', 'Honduras',
        'Hungary', 'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy',
        'Jamaica', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kiribati', 'Kuwait', 'Kyrgyzstan', 'Laos',
        'Latvia', 'Lebanon', 'Lesotho', 'Liberia', 'Libya', 'Liechtenstein', 'Lithuania', 'Luxembourg',
        'Madagascar', 'Malawi', 'Malaysia', 'Maldives', 'Mali', 'Malta', 'Marshall Islands', 'Mauritania',
        'Mauritius', 'Mexico', 'Micronesia', 'Moldova', 'Monaco', 'Mongolia', 'Montenegro', 'Morocco',
        'Mozambique', 'Myanmar', 'Namibia', 'Nauru', 'Nepal', 'Netherlands', 'New Zealand', 'Nicaragua',
        'Niger', 'Nigeria', 'North Korea', 'North Macedonia', 'Norway', 'Oman', 'Pakistan', 'Palau',
        'Panama', 'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines', 'Poland', 'Portugal', 'Qatar',
        'Romania', 'Russia', 'Rwanda', 'Saint Kitts and Nevis', 'Saint Lucia', 'Saint Vincent and the Grenadines',
        'Samoa', 'San Marino', 'São Tomé and Príncipe', 'Saudi Arabia', 'Senegal', 'Serbia', 'Seychelles',
        'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia', 'Solomon Islands', 'Somalia', 'South Africa',
        'South Korea', 'South Sudan', 'Spain', 'Sri Lanka', 'Sudan', 'Suriname', 'Sweden', 'Switzerland',
        'Syria', 'Tajikistan', 'Tanzania', 'Thailand', 'Timor-Leste', 'Togo', 'Tonga', 'Trinidad and Tobago',
        'Tunisia', 'Türkiye', 'Turkmenistan', 'Tuvalu', 'Uganda', 'Ukraine', 'United Arab Emirates',
        'United Kingdom', 'United States', 'Uruguay', 'Uzbekistan', 'Vanuatu', 'Venezuela', 'Vietnam',
        'Yemen', 'Zambia', 'Zimbabwe',
    ];
    assert.equal(new Set(UN_MEMBER_STATES_193).size, 193);
    for (const country of UN_MEMBER_STATES_193) {
        const res = resolveCoords(`${country} policy briefing`, 'International report');
        assert.equal(res.precision, 'named-place', `Expected named-place for UN member state ${country}`);
        assert.equal(Array.isArray(res.coords) && res.coords.length === 2, true, `Expected coords for ${country}`);
    }
    for (const casePlace of ['Somaliland', 'Western Sahara', 'Greenland', 'Essequibo', 'Transnistria', 'Mekong', 'El Fasher', 'Hargeisa', 'Palestine', 'Vatican']) {
        const res = resolveCoords(`${casePlace} development update`, 'Case briefing');
        assert.equal(res.precision, 'named-place', `Expected named-place for ${casePlace}`);
    }

    // Global stories with no named place remain unpinned (Latitude: null, Longitude: null, global-unmapped)
    const climateFeed = {
        id: 'un-news-climate',
        region: 'Global / Transnational',
        issueHints: ['Climate & Resources'],
        fallbackCoords: null,
    };
    const cop31 = assessArticle({
        title: 'COP31 enters decisive week as climate talks face political test',
        snippet: 'Global delegates negotiate climate finance targets and mitigation pathways.',
        source: 'UN News',
        date: '2026-11-16',
        link: 'https://news.un.org/en/story/2026/11/1168812',
    }, climateFeed, { scraperSource: 'institutional-rss', isInstitutionalHub: true });
    const aiChildren = assessArticle({
        title: 'AI hands predators new ways to target children worldwide',
        snippet: 'United Nations report urges stronger digital safeguards on artificial intelligence platforms.',
        source: 'UN News',
        date: '2026-11-19',
        link: 'https://news.un.org/en/story/2026/11/1168841',
    }, climateFeed, { scraperSource: 'institutional-rss', isInstitutionalHub: true });
    for (const item of [cop31, aiChildren]) {
        assert.equal(item.Latitude, null);
        assert.equal(item.Longitude, null);
        assert.equal(item.coverage.locationPrecision, 'global-unmapped');
    }

    // Fallback items sharing coordinates are de-stacked deterministically
    const stacked = selectDiverseArticles([
        {
            url: 'https://news.un.org/en/story/2026/11/a',
            'Entity/Subject': 'Global treaty financing talks open',
            Latitude: '12',
            Longitude: '-18',
            coverage: { region: 'Global / Transnational', issue: 'Economy & Development', sourceRole: 'institutional', relevanceScore: 80, locationPrecision: 'regional' },
            _publisherDomain: 'news.un.org',
            _isInstitutionalHub: true,
            _topicCluster: 'global:a',
        },
        {
            url: 'https://news.un.org/en/story/2026/11/b',
            'Entity/Subject': 'Global climate resilience fund launched',
            Latitude: '12',
            Longitude: '-18',
            coverage: { region: 'Global / Transnational', issue: 'Climate & Resources', sourceRole: 'institutional', relevanceScore: 78, locationPrecision: 'regional' },
            _publisherDomain: 'news.un.org',
            _isInstitutionalHub: true,
            _topicCluster: 'global:b',
        },
    ]);
    assert.equal(stacked.length, 2);
    assert.notEqual(
        `${stacked[0].Latitude},${stacked[0].Longitude}`,
        `${stacked[1].Latitude},${stacked[1].Longitude}`,
        'Items sharing fallback coordinates must not stack on one point'
    );
});

test('snapshot-store isolates deploy-preview and non-production Blobs from production and all Blobs functions thread runtime context', async () => {
    const { pathToFileURL } = require('node:url');
    const storeMod = await import(pathToFileURL(path.resolve(__dirname, '../_shared/snapshot-store.mjs')).href);
    const {
        STORE_NAME,
        isProductionContext,
        readSnapshot,
        resolveDeployContext,
        resolveSnapshotStore,
        writeSnapshot,
    } = storeMod;

    assert.equal(resolveDeployContext({ context: { deploy: { context: 'production' } }, env: {} }), 'production');
    assert.equal(resolveDeployContext({ context: { deploy: { context: 'deploy-preview' } }, env: { CONTEXT: 'production' } }), 'deploy-preview');
    assert.equal(resolveDeployContext({ context: { deploy: { context: 'branch-deploy' } }, env: {} }), 'branch-deploy');
    assert.equal(resolveDeployContext({ context: { deploy: { published: true } }, env: {} }), 'production');
    assert.equal(resolveDeployContext({ context: { deploy: { published: false } }, env: { CONTEXT: 'production' } }), 'deploy-preview');
    assert.equal(resolveDeployContext({ context: null, env: { CONTEXT: 'production' } }), 'production');
    assert.equal(resolveDeployContext({ context: null, env: {} }), 'non-production');

    assert.equal(isProductionContext({ context: { deploy: { context: 'production' } } }), true);
    assert.equal(isProductionContext({ context: { deploy: { context: 'deploy-preview' } } }), false);
    assert.equal(isProductionContext({ context: null, env: {} }), false);

    const storeCalls = [];
    const prodData = new Map();
    const previewData = new Map();
    const makeStore = (bucket, label) => ({
        get: async key => {
            storeCalls.push(`get:${label}:${key}`);
            return bucket.get(key) ?? null;
        },
        setJSON: async (key, value) => {
            storeCalls.push(`set:${label}:${key}`);
            bucket.set(key, value);
        },
    });
    const fakeGetStore = name => {
        assert.equal(name, STORE_NAME);
        return makeStore(prodData, 'site');
    };
    const fakeGetDeployStore = name => {
        assert.equal(name, STORE_NAME);
        return makeStore(previewData, 'deploy');
    };

    const previewStore = resolveSnapshotStore({
        context: { deploy: { context: 'deploy-preview' } },
        env: {},
        getStoreFn: fakeGetStore,
        getDeployStoreFn: fakeGetDeployStore,
    });
    await previewStore.setJSON('public-intel/current.json', { from: 'preview' });
    assert.equal(prodData.has('public-intel/current.json'), false, 'Preview write must never touch site-wide store');

    await writeSnapshot('public-intel/current.json', { from: 'prod' }, {
        context: { deploy: { context: 'production' } },
        env: {},
        getStoreFn: fakeGetStore,
        getDeployStoreFn: fakeGetDeployStore,
    });
    await writeSnapshot('public-intel/current.json', { from: 'branch' }, {
        context: { deploy: { context: 'branch-deploy' } },
        env: {},
        getStoreFn: fakeGetStore,
        getDeployStoreFn: fakeGetDeployStore,
    });
    const prodRead = await readSnapshot('public-intel/current.json', {
        context: { deploy: { context: 'production' } },
        env: {},
        getStoreFn: fakeGetStore,
        getDeployStoreFn: fakeGetDeployStore,
    });
    assert.deepEqual(prodRead, { from: 'prod' });
    assert.deepEqual(previewData.get('public-intel/current.json'), { from: 'branch' });
    assert.equal(storeCalls.includes('set:deploy:public-intel/current.json'), true);

    for (const fileName of ['public-intel.mjs', 'refresh-public-intel.mjs']) {
        const src = fs.readFileSync(path.join(__dirname, '..', fileName), 'utf8');
        assert.match(src, /\{\s*context\s*\}/, `${fileName} must pass runtime deploy context into snapshot-store`);
    }
});
