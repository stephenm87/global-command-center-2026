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
    ALLAFRICA_RSS_FEEDS,
    INSTITUTIONAL_RSS_FEEDS,
    OPEN_LICENSED_RSS_FEEDS,
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

    // Snippet truncation cap and BBC RSS query-param stripping
    const longDescription = 'UN officials say '.repeat(25);
    const longXml = `<?xml version="1.0" encoding="utf-8"?><rss version="2.0"><channel><item>
        <title>Romania energy talks advance</title>
        <link>https://www.bbc.com/news/articles/cr123456?at_medium=RSS&amp;at_campaign=rss</link>
        <description>${longDescription}</description>
        <pubDate>Thu, 19 Nov 2026 04:00:00 +0000</pubDate>
    </item></channel></rss>`;
    const [longItem] = parseRssItems(longXml, { sourceName: 'BBC News', maxItems: 5, now: fixedNow });
    assert.equal(longItem.snippet.length <= 220, true, 'RSS snippets must stay short (<= 220 chars)');
    assert.equal(longItem.snippet.endsWith('…'), true);
    const { normalizeHttpsUrl } = require('../_shared/intel-normalization');
    assert.equal(normalizeHttpsUrl(longItem.link), 'https://www.bbc.com/news/articles/cr123456');

    // Direct freshness & URL/pubDate drift checks
    assert.equal(isFreshAndConsistentDate('2026-11-10', 'https://news.un.org/en/story/2026/11/123', { now: fixedNow }), true);
    assert.equal(isFreshAndConsistentDate('2026-10-01', 'https://news.un.org/en/story/2026/10/123', { now: fixedNow }), false, 'Items older than 30 days must be rejected');
    assert.equal(isFreshAndConsistentDate('2026-11-19', 'https://example.org/2020/08/old-report', { now: fixedNow }), false, 'URL date disagreeing by >30 days must be rejected');
    assert.equal(isFreshAndConsistentDate('not-a-date', 'https://news.un.org/en/story/2026/11/123', { now: fixedNow }), false, 'Unparseable date must be rejected');

    // Confirm stale WHO RSS feed is removed and AllAfrica feeds are configured as headline-only with attribution
    assert.equal(INSTITUTIONAL_RSS_FEEDS.some(f => f.url.includes('who.int/rss-feeds/news-english.xml')), false);
    assert.equal(ALLAFRICA_RSS_FEEDS.length, 3);
    assert.equal(ALLAFRICA_RSS_FEEDS.every(f => f.attributionUrl === 'https://allafrica.com/' && f.sourceName === 'allAfrica.com' && f.maxSnippetChars === 0), true);

    // Trimmed live RSS 2.0 shape served by allAfrica's .rdf endpoints (CDATA title, category, pubDate, empty snippet)
    const allafricaLiveXml = `<?xml version="1.0" encoding="utf-8"?>
        <rss version="2.0"><channel>
            <item>
                <title><![CDATA[Sudan: Britain Expresses Readiness to Support Efforts of Sudanese Dialogue Preparatory Committee]]></title>
                <link>https://allafrica.com/stories/202611190226.html</link>
                <description><![CDATA[[SNA] - Britain has expressed interest in supporting the efforts of the Sudanese Dialogue Preparatory Committee.]]></description>
                <category>Conflict</category>
                <pubDate>Thu, 19 Nov 2026 08:30:00 GMT</pubDate>
            </item>
        </channel></rss>`;
    const [aaLiveItem] = parseRssItems(allafricaLiveXml, {
        sourceName: 'allAfrica.com',
        attributionUrl: 'https://allafrica.com/',
        maxSnippetChars: 0,
        maxItems: 8,
        now: fixedNow,
    });
    assert.equal(aaLiveItem.title, 'Sudan: Britain Expresses Readiness to Support Efforts of Sudanese Dialogue Preparatory Committee');
    assert.equal(aaLiveItem.snippet, '', 'AllAfrica terms permit headlines only; syndicated body excerpt must be omitted');
    assert.equal(aaLiveItem.date, '2026-11-19');
    assert.equal(aaLiveItem.attributionUrl, 'https://allafrica.com/');

    const rdfXml = `<?xml version="1.0" encoding="utf-8"?>
        <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dc="http://purl.org/dc/elements/1.1/">
            <item rdf:about="https://allafrica.com/stories/202611190001.html">
                <title>AU mediation delegates meet in Kenya over Horn talks</title>
                <link>http://allafrica.com/stories/202611190001.html</link>
                <description>Diplomatic delegations opened security talks on cross-border peace.</description>
                <dc:date>2026-11-19T12:00:00Z</dc:date>
            </item>
        </rdf:RDF>`;
    const [rdfItem] = parseRssItems(rdfXml, {
        sourceName: 'allAfrica.com',
        attributionUrl: 'https://allafrica.com/',
        upgradeHttpHost: 'allafrica.com',
        maxItems: 5,
        now: fixedNow,
    });
    assert.equal(rdfItem.link, 'https://allafrica.com/stories/202611190001.html');
    assert.equal(rdfItem.date, '2026-11-19');
    assert.equal(rdfItem.attributionUrl, 'https://allafrica.com/');

    // Open-licensed RSS feeds (Devpolicy Blog, Global Voices, Mongabay)
    assert.deepEqual(OPEN_LICENSED_RSS_FEEDS.map(f => f.id), ['devpolicy-blog', 'global-voices', 'mongabay-news']);

    const devpolicyXml = `<?xml version="1.0" encoding="utf-8"?>
        <rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel>
            <item>
                <title>Gardens in distress: drought, pollution and deep-sea mining in New Ireland</title>
                <link>https://devpolicy.org/gardens-in-distress-20261120/</link>
                <dc:creator><![CDATA[Philippa Louey and Godfrey Jordan Abage]]></dc:creator>
                <description><![CDATA[As drought withers New Ireland's land gardens, pollution and deep-sea mining threaten local ocean waters.<h4><b>Disclosure</b></h4><p>This research was supported by the Pacific Research Program.</p><h4><b>About the author/s</b></h4><p>Philippa Louey is a researcher.</p>]]></description>
                <pubDate>Thu, 19 Nov 2026 19:00:44 +0000</pubDate>
            </item>
        </channel></rss>`;
    const [devItem] = parseRssItems(devpolicyXml, {
        sourceName: 'Devpolicy Blog',
        fundingLabel: 'University research blog (ANU Crawford School, CC BY-NC-SA 4.0)',
        attributionUrl: 'https://devpolicy.org/',
        contentType: 'analysis',
        requireAuthor: true,
        now: fixedNow,
    });
    assert.equal(devItem.author, 'Philippa Louey and Godfrey Jordan Abage');
    assert.equal(devItem.contentType, 'analysis');
    assert.equal(devItem.snippet, "As drought withers New Ireland's land gardens, pollution and deep-sea mining threaten local ocean waters.");
    assert.ok(!devItem.snippet.includes('Disclosure'), 'WordPress Disclosure boilerplate must be stripped');

    // Heading containing "Disclosure" as part of the article subject must be preserved, while <p><strong>Disclosure</strong></p> strips cleanly, and long author names cap at 120 chars
    const disclosureEdgeXml = `<?xml version="1.0" encoding="utf-8"?>
        <rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel>
            <item>
                <title>Mining transparency rules debated in Papua New Guinea</title>
                <link>https://devpolicy.org/mining-disclosure-png-20261120/</link>
                <dc:creator><![CDATA[${'Dr. Researcher '.repeat(12)}]]></dc:creator>
                <description><![CDATA[<h2>Disclosure rules in PNG mining</h2><p>Lawmakers reviewed royalty reporting rules across provinces.</p><p><strong>Disclosure</strong></p><p>Supported by university grant.</p>]]></description>
                <pubDate>Thu, 19 Nov 2026 19:00:44 +0000</pubDate>
            </item>
        </channel></rss>`;
    const [discEdgeItem] = parseRssItems(disclosureEdgeXml, {
        sourceName: 'Devpolicy Blog',
        contentType: 'analysis',
        requireAuthor: true,
        now: fixedNow,
    });
    assert.match(discEdgeItem.snippet, /^Disclosure rules in PNG mining Lawmakers reviewed royalty reporting rules across provinces\.$/);
    assert.ok(!discEdgeItem.snippet.includes('university grant'), 'Standalone <p><strong>Disclosure</strong></p> boilerplate must strip');
    assert.equal(discEdgeItem.author.length <= 120, true, 'Over-long author strings must cap cleanly at 120 chars');

    const mongabayXml = `<?xml version="1.0" encoding="utf-8"?>
        <rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel>
            <item>
                <title>Peruvian officials increase seizure tally in wildlife trafficking probe</title>
                <link>https://news.mongabay.com/2026/11/peru-trafficking-probe/</link>
                <dc:creator><![CDATA[Mongabay.com]]></dc:creator>
                <author><![CDATA[Naina Rao]]></author>
                <description><![CDATA[Authorities expanded enforcement against cross-border wildlife trafficking networks in Peru.]]></description>
                <pubDate>Thu, 19 Nov 2026 19:11:03 +0000</pubDate>
            </item>
        </channel></rss>`;
    const [mongoItem] = parseRssItems(mongabayXml, {
        sourceName: 'Mongabay',
        fundingLabel: 'Nonprofit conservation journalism (CC BY-ND 4.0)',
        attributionUrl: 'https://news.mongabay.com/',
        requireAuthor: true,
        now: fixedNow,
    });
    assert.equal(mongoItem.author, 'Naina Rao', 'Mongabay generic dc:creator must fall back to human <author>');
    assert.equal(mongoItem.contentType, 'news');

    const gvXml = `<?xml version="1.0" encoding="utf-8"?>
        <rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel>
            <item>
                <title>Support Global Voices' December Spotlight: Digital Communities</title>
                <link>https://globalvoices.org/2026/11/19/support-global-voices/</link>
                <dc:creator><![CDATA[Global Voices Announcements]]></dc:creator>
                <description><![CDATA[Support our digital campaign this month.]]></description>
                <pubDate>Thu, 19 Nov 2026 00:00:00 +0000</pubDate>
            </item>
            <item>
                <title>Why Japan's anti-hate legislation falls short of human rights commitments</title>
                <link>https://globalvoices.org/2026/11/20/why-japans-anti-hate-measures-fall-short/</link>
                <dc:creator><![CDATA[Jo Carter]]></dc:creator>
                <description><![CDATA[Legal experts cite gaps in domestic legislation and human rights enforcement.]]></description>
                <pubDate>Fri, 20 Nov 2026 00:00:00 +0000</pubDate>
            </item>
        </channel></rss>`;
    const gvItems = parseRssItems(gvXml, {
        sourceName: 'Global Voices',
        fundingLabel: 'Nonprofit volunteer & citizen media (CC BY 3.0)',
        attributionUrl: 'https://globalvoices.org/',
        requireAuthor: true,
        now: new Date('2026-11-20T06:00:00Z'),
    });
    assert.equal(gvItems.length, 1, 'Announcement item with generic Global Voices Announcements creator must be dropped');
    assert.equal(gvItems[0].author, 'Jo Carter');

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
    const bbcRss = `<?xml version="1.0" encoding="utf-8"?>
        <rss version="2.0"><channel>
            <item>
                <title>Lesotho highland water treaty signed after security talks</title>
                <link>https://www.bbc.com/news/articles/lesotho2026?at_medium=RSS&amp;at_campaign=rss</link>
                <description><![CDATA[Diplomacy and treaty negotiations conclude over regional water sharing and infrastructure.]]></description>
                <pubDate>Thu, 19 Nov 2026 04:00:00 +0000</pubDate>
            </item>
        </channel></rss>`;
    const allafricaRdf = `<?xml version="1.0" encoding="utf-8"?>
        <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dc="http://purl.org/dc/elements/1.1/">
            <item rdf:about="https://allafrica.com/stories/202611190042.html">
                <title>Ghana parliament passes electoral governance reform bill</title>
                <link>https://allafrica.com/stories/202611190042.html</link>
                <description>Lawmakers backed oversight protections ahead of local elections.</description>
                <dc:date>2026-11-19T06:00:00Z</dc:date>
            </item>
        </rdf:RDF>`;
    const devpolicyRss = `<?xml version="1.0" encoding="utf-8"?>
        <rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel>
            <item>
                <title>Gardens in distress: drought, pollution and deep-sea mining in New Ireland</title>
                <link>https://devpolicy.org/gardens-in-distress-20261119/</link>
                <dc:creator><![CDATA[Philippa Louey and Godfrey Jordan Abage]]></dc:creator>
                <description><![CDATA[As drought withers New Ireland gardens in Papua New Guinea, pollution and deep-sea mining threaten local ocean waters.<h4><b>Disclosure</b></h4><p>Research note.</p>]]></description>
                <pubDate>Thu, 19 Nov 2026 04:00:00 +0000</pubDate>
            </item>
        </channel></rss>`;
    const globalVoicesRss = `<?xml version="1.0" encoding="utf-8"?>
        <rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel>
            <item>
                <title>Family stories keep alive Georgia's democratic past and human rights memory</title>
                <link>https://globalvoices.org/2026/11/19/georgia-democratic-memory/</link>
                <dc:creator><![CDATA[Daria Dergacheva]]></dc:creator>
                <description><![CDATA[Oral history archives examine human rights, repression, and democratic accountability in Georgia.]]></description>
                <pubDate>Thu, 19 Nov 2026 04:00:00 +0000</pubDate>
            </item>
        </channel></rss>`;
    const mongabayRss = `<?xml version="1.0" encoding="utf-8"?>
        <rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel>
            <item>
                <title>Indigenous communities challenge Brazil deforestation and biodiversity policy</title>
                <link>https://news.mongabay.com/2026/11/brazil-deforestation-policy/</link>
                <dc:creator><![CDATA[Mongabay.com]]></dc:creator>
                <author><![CDATA[Karla Mendes]]></author>
                <description><![CDATA[Indigenous leaders urged federal ministries to enforce conservation boundaries in the Amazon basin.]]></description>
                <pubDate>Thu, 19 Nov 2026 04:00:00 +0000</pubDate>
            </item>
        </channel></rss>`;
    const fetchImpl = async (url) => {
        calledUrls.push(String(url));
        if (String(url).includes('google.serper.dev')) {
            throw new Error('Serper must not be called when paused');
        }
        if (String(url).includes('bbci.co.uk')) {
            return { ok: true, text: async () => bbcRss };
        }
        if (String(url).includes('allafrica.com')) {
            return { ok: true, text: async () => allafricaRdf };
        }
        if (String(url).includes('devpolicy.org')) {
            return { ok: true, text: async () => devpolicyRss };
        }
        if (String(url).includes('globalvoices.org')) {
            return { ok: true, text: async () => globalVoicesRss };
        }
        if (String(url).includes('mongabay.com')) {
            return { ok: true, text: async () => mongabayRss };
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
    assert.equal(snapshot.meta.snapshotSchemaVersion, 3);
    assert.equal(snapshot.meta.errorCode, undefined);
    assert.equal('serperStatus' in snapshot.meta, false, 'Public meta must not expose billing state');
    assert.equal(snapshot.items.length, 8);
    assert.equal(calledUrls.some(u => u.includes('google.serper.dev')), false);
    assert.match(snapshot.meta.provider, /UN News RSS/);
    assert.match(snapshot.meta.provider, /BBC News RSS/);
    assert.match(snapshot.meta.provider, /allAfrica RSS/);
    assert.match(snapshot.meta.provider, /Devpolicy Blog RSS/);
    assert.match(snapshot.meta.provider, /Global Voices RSS/);
    assert.match(snapshot.meta.provider, /Mongabay RSS/);
    assert.match(snapshot.meta.provider, /ReliefWeb/);
    assert.match(snapshot.meta.provider, /GDELT/);
    assert.deepEqual(
        snapshot.meta.providerResults.map(r => [r.provider, r.status]),
        [
            ['UN News RSS', 'ok'],
            ['BBC News RSS', 'ok'],
            ['allAfrica RSS', 'ok'],
            ['Devpolicy Blog RSS', 'ok'],
            ['Global Voices RSS', 'ok'],
            ['Mongabay RSS', 'ok'],
            ['ReliefWeb', 'ok'],
            ['GDELT', 'ok'],
        ]
    );
    const bbcItem = snapshot.items.find(it => it.Source === 'BBC News');
    assert.ok(bbcItem, 'Expected BBC News item in live snapshot');
    assert.equal(bbcItem.coverage.fundingLabel, 'Public broadcaster, UK licence fee');
    assert.equal(bbcItem.coverage.attributionUrl, 'https://www.bbc.com/news');
    assert.equal(bbcItem.url, 'https://www.bbc.com/news/articles/lesotho2026');
    const allafricaItem = snapshot.items.find(it => it.Source === 'allAfrica.com');
    assert.ok(allafricaItem, 'Expected allAfrica.com item in live snapshot');
    assert.equal(allafricaItem.coverage.fundingLabel, 'Pan-African news aggregator (commercial & syndicated)');
    assert.equal(allafricaItem.coverage.attributionUrl, 'https://allafrica.com/');
    assert.equal(allafricaItem.coverage.sourceRole, 'regional');
    const devItemSnap = snapshot.items.find(it => it.Source === 'Devpolicy Blog');
    assert.ok(devItemSnap, 'Expected Devpolicy Blog item in live snapshot');
    assert.equal(devItemSnap.coverage.region, 'Pacific Islands');
    assert.equal(devItemSnap.coverage.contentType, 'analysis');
    assert.equal(devItemSnap.coverage.sourceRole, 'research');
    assert.equal(devItemSnap.coverage.matchedPlace, 'new ireland', 'New Ireland must pin in Pacific Islands, never Ireland in Europe');
    assert.equal(devItemSnap.author, 'Philippa Louey and Godfrey Jordan Abage');
    assert.equal(devItemSnap.coverage.fundingLabel, 'University research blog (ANU Crawford School, CC BY-NC-SA 4.0)');
    const gvSnap = snapshot.items.find(it => it.Source === 'Global Voices');
    assert.ok(gvSnap);
    assert.equal(gvSnap.author, 'Daria Dergacheva');
    assert.equal(gvSnap.coverage.fundingLabel, 'Nonprofit volunteer & citizen media (CC BY 3.0)');
    const mongoSnap = snapshot.items.find(it => it.Source === 'Mongabay');
    assert.ok(mongoSnap);
    assert.equal(mongoSnap.author, 'Karla Mendes');
    assert.equal(mongoSnap.coverage.fundingLabel, 'Nonprofit conservation journalism (CC BY-ND 4.0)');
    assert.ok(snapshot.meta.coverage.regions['Pacific Islands'] >= 1, 'Pacific Islands region must be covered');
    const unItem = snapshot.items.find(it => it.Source === 'UN News');
    assert.equal(unItem.coverage.fundingLabel, 'UN institutional reporting');
    assert.equal(snapshot.items.some(it => /independent/i.test(it.coverage.fundingLabel || '')), false);
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

    const bbcFeed = {
        id: 'bbc-world-news',
        region: 'Global / Transnational',
        issueHints: ['Security & Diplomacy', 'Governance & Rights', 'Economy & Development'],
        fallbackCoords: null,
        sourceName: 'BBC News',
        fundingLabel: 'Public broadcaster, UK licence fee',
        attributionUrl: 'https://www.bbc.com/news',
    };
    const anthropicIpo = assessArticle({
        title: "Anthropic becomes one of world's most valuable public companies",
        snippet: 'The artificial intelligence company surged in its stock market debut on New York markets.',
        source: 'BBC News',
        date: '2026-11-19',
        link: 'https://www.bbc.com/news/articles/anthropic-ipo-2026',
    }, bbcFeed, { scraperSource: 'public-rss', isInstitutionalHub: false, isConfiguredFeed: true });
    const corporateEarnings = assessArticle({
        title: 'Tech conglomerate reports record quarterly earnings on cloud demand',
        snippet: 'Investors cheered higher profit margins and technology revenue.',
        source: 'BBC News',
        date: '2026-11-19',
        link: 'https://www.bbc.com/news/articles/earnings-2026',
    }, bbcFeed, { scraperSource: 'public-rss', isInstitutionalHub: false, isConfiguredFeed: true });
    const aiPolicyStory = assessArticle({
        title: 'European Union regulators open AI governance and competition probe',
        snippet: 'Lawmakers and regulators cite national security and digital market policy rules.',
        source: 'BBC News',
        date: '2026-11-19',
        link: 'https://www.bbc.com/news/articles/eu-ai-probe-2026',
    }, bbcFeed, { scraperSource: 'public-rss', isInstitutionalHub: false, isConfiguredFeed: true });

    const crimeanStrikesStory = assessArticle({
        title: "Putin vows 'far more painful' response to Ukraine's strikes on Crimean Bridge",
        snippet: 'The bridge, a symbol of Russia occupation of Crimea, suffered major damage in drone and missile attacks.',
        source: 'BBC News',
        date: '2026-11-19',
        link: 'https://www.bbc.com/news/articles/crimean-bridge-2026',
    }, bbcFeed, { scraperSource: 'public-rss', isInstitutionalHub: false, isConfiguredFeed: true });
    const appleValuation = assessArticle({
        title: 'Apple valued at $5tn as hardware sales climb',
        snippet: 'Analysts expect government contracts and enterprise purchases to boost annual revenue.',
        source: 'BBC News',
        date: '2026-11-19',
        link: 'https://www.bbc.com/news/articles/apple-5tn-2026',
    }, bbcFeed, { scraperSource: 'public-rss', isInstitutionalHub: false, isConfiguredFeed: true });
    const laborStrike = assessArticle({
        title: 'Tesla workers strike at German plant',
        snippet: 'Union members walked out overnight over factory shift pay demands.',
        source: 'BBC News',
        date: '2026-11-19',
        link: 'https://www.bbc.com/news/articles/tesla-strike-2026',
    }, bbcFeed, { scraperSource: 'public-rss', isInstitutionalHub: false, isConfiguredFeed: true });

    const allafricaFeed = {
        id: 'allafrica-conflict',
        region: 'Africa',
        issueHints: ['Security & Diplomacy', 'Health & Human Security', 'Governance & Rights'],
        fallbackCoords: [4.8, 21.4],
        sourceName: 'allAfrica.com',
        fundingLabel: 'Pan-African news aggregator (commercial & syndicated)',
        attributionUrl: 'https://allafrica.com/',
    };
    const headlineOnlyAssess = (title, slug) => assessArticle({
        title,
        snippet: '',
        source: 'allAfrica.com',
        date: '2026-11-19',
        link: `https://allafrica.com/stories/${slug}.html`,
    }, allafricaFeed, { scraperSource: 'public-rss', isInstitutionalHub: false, isConfiguredFeed: true });

    const sudanDialogue = headlineOnlyAssess(
        'Sudan: Britain Expresses Readiness to Support Efforts of Sudanese Dialogue Preparatory Committee',
        '202611190226'
    );
    const nigeriaViolence = headlineOnlyAssess(
        'Nigeria: Rising Wave of Political Violence',
        '202611190227'
    );
    const whoEbolaShares = headlineOnlyAssess(
        'WHO shares Ebola outbreak data as cases rise in Uganda',
        '202611190228'
    );
    const afcftaIntegration = headlineOnlyAssess(
        "AfCFTA: Afreximbank and AfDB Must Drive Africa's Economic Integration",
        '202611190229'
    );
    const ghanaMercury = headlineOnlyAssess(
        'Ghana, US Deepen Cooperation to Tackle Mercury Pollution',
        '202611190230'
    );
    const gdeltDiscovery = assessArticle({
        title: 'ASEAN ministers discuss South China Sea maritime diplomacy',
        snippet: 'Reported via example-paper.org (Asia-Pacific).',
        source: 'example-paper.org',
        date: '2026-11-19',
        link: 'https://example-paper.org/asean-2026',
    }, FIXED_QUERIES[1], { scraperSource: 'gdelt-doc', isInstitutionalHub: false });

    assert.equal(promotional, null);
    assert.equal(unrelated, null);
    assert.equal(anthropicIpo, null, 'Pure IPO / stock-market story with no political actor or policy angle must be dropped');
    assert.equal(corporateEarnings, null, 'Pure corporate earnings story must be dropped');
    assert.equal(appleValuation, null, 'Corporate valuation headline without political title angle must be dropped');
    assert.equal(laborStrike, null, 'Labor wage strike without state/policy angle must not match military strike rule');
    assert.ok(aiPolicyStory, 'AI story with explicit regulators / policy governance angle must remain eligible');
    assert.ok(crimeanStrikesStory, 'Geopolitical war/occupation headline must remain eligible');
    assert.ok(sudanDialogue, 'Headline-only AllAfrica dialogue story must be retained');
    assert.ok(nigeriaViolence, 'Headline-only AllAfrica political violence story must be retained');
    assert.ok(whoEbolaShares, '"WHO shares Ebola outbreak data" must not trigger corporate share-price filter');
    assert.ok(afcftaIntegration, 'AfCFTA continental economic integration story must be retained');
    assert.ok(ghanaMercury, 'Bilateral environmental cooperation headline must be retained');
    assert.ok(gdeltDiscovery, 'GDELT discovery items without body snippet must remain eligible under discovery threshold');
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

test('selection balances regions and issues while limiting publishers, clusters, and discovery sources', async () => {
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
    assert.equal(selected.every(item => !('_publisherDomain' in item) && !('_topicCluster' in item) && !('_isConfiguredFeed' in item)), true);

    // No single publisher may supply > 1/3 of selected items when 3+ publishers contribute
    const publishers = [
        { domain: 'news.un.org', role: 'institutional', hub: true },
        { domain: 'bbc.co.uk', role: 'independent-news', hub: false },
        { domain: 'globalvoices.org', role: 'regional', hub: false },
    ];
    const balancedCandidates = [];
    for (const [pubIdx, pub] of publishers.entries()) {
        for (let n = 0; n < 10; n += 1) {
            const reg = TARGET_REGIONS[(n + pubIdx) % TARGET_REGIONS.length];
            const iss = TARGET_ISSUES[(n + pubIdx) % TARGET_ISSUES.length];
            balancedCandidates.push({
                url: `https://${pub.domain}/story-${pubIdx}-${n}`,
                'Entity/Subject': `Publisher ${pubIdx} story ${n}`,
                coverage: { region: reg, issue: iss, sourceRole: pub.role, sourceRoleLabel: SOURCE_ROLE_LABELS[pub.role], relevanceScore: 95 - n },
                _publisherDomain: pub.domain,
                _isInstitutionalHub: pub.hub,
                _isConfiguredFeed: true,
                _topicCluster: `${pubIdx}:${n}`,
            });
        }
    }
    const cappedSelection = selectDiverseArticles(balancedCandidates, 18);
    const pubCounts = cappedSelection.reduce((acc, item) => {
        const host = new URL(item.url).hostname;
        acc[host] = (acc[host] || 0) + 1;
        return acc;
    }, {});
    assert.equal(cappedSelection.length, 18);
    for (const [host, count] of Object.entries(pubCounts)) {
        assert.equal(count <= Math.floor(cappedSelection.length / 3), true, `${host} supplied ${count}/${cappedSelection.length} (> 1/3)`);
    }

    // Asymmetric 3-publisher pool (e.g., 10 UN + 10 BBC + 4 Devpolicy) also respects <= 1/3
    const asymmetricCandidates = balancedCandidates.filter(c => c._publisherDomain !== 'globalvoices.org' || /story-2-[0-3]$/.test(c.url));
    const asymSelected = selectDiverseArticles(asymmetricCandidates, 20);
    const asymCounts = asymSelected.reduce((acc, item) => {
        const host = new URL(item.url).hostname;
        acc[host] = (acc[host] || 0) + 1;
        return acc;
    }, {});
    assert.equal(asymSelected.length >= 12, true);
    for (const [host, count] of Object.entries(asymCounts)) {
        assert.equal(count <= Math.floor(asymSelected.length / 3), true, `Asymmetric ${host} supplied ${count}/${asymSelected.length} (> 1/3)`);
    }

    // Skewed 3-publisher pool (e.g., 10 UN + 10 BBC + 2 minor items) must not collapse feed down to 6 items
    const skewedCandidates = balancedCandidates.filter(c => c._publisherDomain !== 'globalvoices.org' || /story-2-[0-1]$/.test(c.url));
    const skewedSelected = selectDiverseArticles(skewedCandidates, 20);
    assert.equal(skewedSelected.length >= 12, true, `Skewed 10/10/2 pool must keep >= 12 items, got ${skewedSelected.length}`);

    // End-to-end 3-publisher RSS fairness: UN News + BBC News + allAfrica.com each <= 1/3
    const makeItems = (publisher, domain, entries) => entries.map(([title, description], idx) => `
        <item>
            <title>${title}</title>
            <link>https://${domain}/stories/${publisher}-2026-11-${idx + 1}</link>
            <description>${description}</description>
            <pubDate>Thu, 19 Nov 2026 04:00:00 +0000</pubDate>
        </item>`).join('');
    const unPool = makeItems('un', 'news.un.org/en/story/2026/11', [
        ['UN delegates open Gaza humanitarian aid corridor talks', 'Humanitarian agencies warn of urgent medical and food aid needs.'],
        ['Security Council reviews Haiti sanctions mandate', 'Diplomats debate peacekeeping support and arms embargo enforcement.'],
        ['UN climate treaty summit opens in Japan', 'Governments negotiate clean energy transition and climate adaptation finance.'],
        ['UN report urges Ukraine humanitarian protection', 'International law and displacement monitors track winter infrastructure strikes.'],
        ['UN peacekeepers monitor Sudan border security', 'Security Council and humanitarian envoys review Darfur aid access.'],
    ]);
    const bbcPool = makeItems('bbc', 'www.bbc.com/news/articles', [
        ['UK parliament debates border asylum law and refugee policy', 'Lawmakers review immigration tribunals and constitutional safeguards.'],
        ['Israel and Lebanon ceasefire negotiations resume', 'Regional diplomats mediate border security guarantees.'],
        ['Philippines protests maritime border incursion', 'Foreign ministry cites territorial sovereignty and international law.'],
        ['Poland elections focus on trade and tariff policy', 'Parliamentary campaigns highlight European economic development rules.'],
        ['Venezuela diplomatic summit addresses sanctions', 'Regional ministers negotiate electoral oversight and trade relief.'],
        ['Fiji climate pact energy and biodiversity talks conclude', 'Pacific leaders urge climate finance and ocean conservation treaties.'],
    ]);
    const aaPool = makeItems('aa', 'allafrica.com/stories/20261119', [
        ['Kenya parliament approves constitutional human rights bill', 'Legislators back judicial independence and civil liberties reform.'],
        ['Nigeria government announces security talks on Sahel border', 'Defence ministers coordinate regional diplomacy and ceasefire monitoring.'],
        ['South Africa summit urges reform of global trade and debt rules', 'Finance ministers negotiate sovereign debt relief and tariff reform.'],
        ['Ethiopia and Somalia diplomats resume humanitarian aid talks', 'African Union mediators press for border stability and displaced aid.'],
        ['Ghana elections commission updates voter oversight rules', 'Electoral officials publish independent governance monitoring guidelines.'],
        ['DRC refugee and health emergency corridor agreement signed', 'Health ministries and humanitarian agencies protect displaced civilians.'],
    ]);
    const balancedSnapshot = await buildPublicSnapshot({
        apiKey: '',
        includeFreeFeeds: true,
        now: new Date('2026-11-19T05:00:00Z'),
        fetchImpl: async (url) => {
            if (String(url).includes('gdeltproject.org')) return { ok: true, json: async () => ({ articles: [] }) };
            if (String(url).includes('bbci.co.uk')) return { ok: true, text: async () => `<rss><channel>${bbcPool}</channel></rss>` };
            if (String(url).includes('allafrica.com')) return { ok: true, text: async () => `<rdf:RDF>${aaPool}</rdf:RDF>` };
            return { ok: true, text: async () => `<rss><channel>${unPool}</channel></rss>` };
        },
    });
    assert.equal(balancedSnapshot.items.length >= 12, true, `Expected >= 12 items with 3 substantive RSS publishers, got ${balancedSnapshot.items.length}`);
    const livePubCounts = balancedSnapshot.items.reduce((acc, it) => {
        acc[it.Source] = (acc[it.Source] || 0) + 1;
        return acc;
    }, {});
    for (const [pub, cnt] of Object.entries(livePubCounts)) {
        assert.equal(cnt <= Math.floor(balancedSnapshot.items.length / 3), true, `${pub} exceeded 1/3 cap (${cnt}/${balancedSnapshot.items.length})`);
    }

    // Specialized regional publisher (span=1 region) beats global publisher (span=2 regions) on equal count in its region
    const spanPool = [
        {
            url: 'https://news.un.org/en/story/2026/11/span-africa',
            'Entity/Subject': 'Global hub story in Africa',
            coverage: { region: 'Africa', issue: 'Security & Diplomacy', sourceRole: 'institutional', relevanceScore: 95 },
            _publisherDomain: 'news.un.org',
            _isInstitutionalHub: true,
            _isConfiguredFeed: true,
            _topicCluster: 'Africa:hub',
        },
        {
            url: 'https://news.un.org/en/story/2026/11/span-asia',
            'Entity/Subject': 'Global hub story in Asia',
            coverage: { region: 'Asia-Pacific', issue: 'Economy & Development', sourceRole: 'institutional', relevanceScore: 70 },
            _publisherDomain: 'news.un.org',
            _isInstitutionalHub: true,
            _isConfiguredFeed: true,
            _topicCluster: 'Asia:hub',
        },
        {
            url: 'https://allafrica.com/stories/span-africa-only',
            'Entity/Subject': 'Specialized Africa story',
            coverage: { region: 'Africa', issue: 'Governance & Rights', sourceRole: 'regional', relevanceScore: 60 },
            _publisherDomain: 'allafrica.com',
            _isInstitutionalHub: false,
            _isConfiguredFeed: true,
            _topicCluster: 'Africa:aa',
        },
    ];
    const spanSelected = selectDiverseArticles(spanPool, 3);
    assert.equal(spanSelected[0].url, 'https://allafrica.com/stories/span-africa-only');
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
    const noGuineaPig = resolveCoords('Guinea pig biomedical study opens at university', 'Medical research');
    assert.equal(noGuineaPig.matchedPlace, null);
    const guineaElection = resolveCoords('Guinea holds legislative election', 'West Africa report');
    assert.equal(guineaElection.matchedPlace, 'guinea');
    const nfdCote = resolveCoords("Co\u0302te d'Ivoire treaty talks open", 'Regional trade cooperation');
    assert.equal(nfdCote.matchedPlace, "côte d'ivoire");
    assert.equal(getCoords('Global AI ethics summit opens'), null, 'getCoords returns null for unmapped stories');

    const unknownPublisher = assessArticle({
        title: 'Romania energy talks advance in parliament',
        snippet: 'Diplomacy and security debate over regional power infrastructure.',
        source: 'Regional Dispatch',
        date: '2026-11-19',
        link: 'https://unknown-blog.example.org/romania-2026',
    }, FIXED_QUERIES[3]);
    assert.equal(unknownPublisher.coverage.fundingLabel, 'Funding source unverified');

    const devpolicyUsAid = assessArticle({
        title: 'One battle after another: US foreign aid after the mid-terms',
        snippet: 'Devpolicy analysis of congressional foreign aid appropriations after election shifts.',
        source: 'Devpolicy Blog',
        author: 'Terence Wood and Cameron Hill',
        contentType: 'analysis',
        date: '2026-11-19',
        link: 'https://devpolicy.org/us-foreign-aid-mid-terms-20261119/',
    }, {
        id: 'devpolicy-blog',
        region: 'Pacific Islands',
        issueHints: ['Economy & Development'],
        fallbackCoords: [-13.5, 172.0],
    }, { scraperSource: 'public-rss', isConfiguredFeed: true });
    assert.equal(devpolicyUsAid.coverage.region, 'Americas & Caribbean', 'Uppercase US aid story must classify as Americas & Caribbean matching its US pin');
    assert.equal(devpolicyUsAid.coverage.contentType, 'analysis');

    // Papua New Guinea must classify as Pacific Islands (never tie Africa via "guinea"),
    // and Pacific Northwest / .png filename tokens must never false-trigger Pacific Islands.
    const pngMongabay = assessArticle({
        title: 'Papua New Guinea communities challenge seabed mining conservation rules',
        snippet: 'Forestry and ocean conservation policy groups met officials in Port Moresby.',
        source: 'Mongabay',
        author: 'Jane Reporter',
        date: '2026-11-19',
        link: 'https://news.mongabay.com/2026/11/png-seabed-2026/',
    }, {
        id: 'mongabay-news',
        region: 'Global / Transnational',
        issueHints: ['Climate & Resources'],
        fallbackCoords: null,
    }, { scraperSource: 'public-rss', isConfiguredFeed: true });
    assert.equal(pngMongabay.coverage.region, 'Pacific Islands', 'Papua New Guinea must never tie Africa via "guinea"');
    assert.equal(pngMongabay.coverage.matchedPlace, 'papua new guinea');

    const pacificNorthwestUs = assessArticle({
        title: 'United States forestry policy shifts in Pacific Northwest watershed',
        snippet: 'Officials published map.png summarizing timber regulation updates.',
        source: 'BBC News',
        date: '2026-11-19',
        link: 'https://www.bbc.com/news/articles/pnw2026',
    }, {
        id: 'bbc-world-news',
        region: 'Global / Transnational',
        issueHints: ['Climate & Resources'],
        fallbackCoords: null,
    }, { scraperSource: 'public-rss', isConfiguredFeed: true });
    assert.equal(pacificNorthwestUs.coverage.region, 'Americas & Caribbean', 'Bare "Pacific" and ".png" must not pull US story into Pacific Islands');
    assert.equal(pacificNorthwestUs.coverage.matchedPlace, 'united states');

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
    assert.equal(resolveDeployContext({ context: { deploy: { context: 'production', published: false } }, env: { CONTEXT: 'production' } }), 'deploy-preview');
    assert.equal(resolveDeployContext({ context: { deploy: { published: false } }, env: { CONTEXT: 'production' } }), 'deploy-preview');
    assert.equal(resolveDeployContext({ context: null, env: { CONTEXT: 'production' } }), 'production');
    assert.equal(resolveDeployContext({ context: null, env: {} }), 'non-production');

    assert.equal(isProductionContext({ context: { deploy: { context: 'production' } } }), true);
    assert.equal(isProductionContext({ context: { deploy: { context: 'production', published: false } } }), false);
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
    const publicIntelSrc = fs.readFileSync(path.join(__dirname, '..', 'public-intel.mjs'), 'utf8');
    assert.match(publicIntelSrc, /snapshotSchemaVersion\s*!==\s*SNAPSHOT_SCHEMA_VERSION/, 'public-intel.mjs must auto-upgrade stale schema snapshots when feeds change');
});

test('Mongabay filters wire-agency items and off-topic video shorts while carrying an accurate source role label', () => {
    const {
        isWireAgencyAuthor,
    } = require('../_shared/free-feeds');
    assert.equal(isWireAgencyAuthor('Associated Press'), true);
    assert.equal(isWireAgencyAuthor('AP'), true);
    assert.equal(isWireAgencyAuthor('AFP'), true);
    assert.equal(isWireAgencyAuthor('Agence France-Presse'), true);
    assert.equal(isWireAgencyAuthor('Reuters'), true);
    assert.equal(isWireAgencyAuthor('Naina Rao'), false);

    const fixedNow = new Date('2026-11-21T02:00:00Z');
    const mongabayMixedXml = `<?xml version="1.0" encoding="utf-8"?>
        <rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel>
            <item>
                <title>There is no going back 'to the way it was before' the Iran war's energy shock, IEA says</title>
                <link>https://news.mongabay.com/short-article/2026/11/iran-energy-shock/</link>
                <dc:creator><![CDATA[Associated Press]]></dc:creator>
                <description><![CDATA[The International Energy Agency reported global energy security shifts.]]></description>
                <pubDate>Thu, 19 Nov 2026 12:00:00 +0000</pubDate>
            </item>
            <item>
                <title>Global climate summit talks stall over adaptation finance</title>
                <link>https://news.mongabay.com/short-article/2026/11/climate-finance/</link>
                <dc:creator><![CDATA[AFP]]></dc:creator>
                <description><![CDATA[PARIS (AFP) — Negotiators clashed over adaptation funding targets.]]></description>
                <pubDate>Thu, 19 Nov 2026 11:00:00 +0000</pubDate>
            </item>
            <item>
                <title>Maritime talks end with new emissions rules</title>
                <link>https://news.mongabay.com/short-article/2026/11/maritime-emissions/</link>
                <dc:creator><![CDATA[Reuters]]></dc:creator>
                <description><![CDATA[LONDON (Reuters) — Governments adopted shipping emissions targets.]]></description>
                <pubDate>Thu, 19 Nov 2026 10:00:00 +0000</pubDate>
            </item>
            <item>
                <title>Grand Canyon South Rim water restrictions ease after repairs</title>
                <link>https://news.mongabay.com/short-article/2026/11/grand-canyon-ap/</link>
                <dc:creator><![CDATA[Jane Reporter]]></dc:creator>
                <description><![CDATA[GRAND CANYON NATIONAL PARK, Ariz. (AP) — Officials eased restrictions.]]></description>
                <pubDate>Thu, 19 Nov 2026 09:00:00 +0000</pubDate>
            </item>
            <item>
                <title>Coastal states debate maritime treaty enforcement</title>
                <link>https://news.mongabay.com/short-article/2026/11/coastal-treaty-ap/</link>
                <dc:creator><![CDATA[Jane Doe / Associated Press]]></dc:creator>
                <description><![CDATA[Governments reviewed maritime enforcement rules.]]></description>
                <pubDate>Thu, 19 Nov 2026 08:45:00 +0000</pubDate>
            </item>
            <item>
                <title>Amazon watershed funding shifts after ministerial talks</title>
                <link>https://news.mongabay.com/short-article/2026/11/amazon-afp-compound/</link>
                <dc:creator><![CDATA[Jane Doe (AFP)]]></dc:creator>
                <description><![CDATA[Ministers met to review forest conservation finance.]]></description>
                <pubDate>Thu, 19 Nov 2026 08:30:00 +0000</pubDate>
            </item>
            <item>
                <title>Mining permits face judicial review in northern provinces</title>
                <link>https://news.mongabay.com/short-article/2026/11/mining-thomson-reuters/</link>
                <dc:creator><![CDATA[Thomson Reuters Foundation]]></dc:creator>
                <description><![CDATA[Judges scheduled hearings on mining oversight.]]></description>
                <pubDate>Thu, 19 Nov 2026 08:15:00 +0000</pubDate>
            </item>
            <item>
                <title>India parliament reviews forest rights compensation rules</title>
                <link>https://news.mongabay.com/short-article/2026/11/india-forest-rights-ap-singh/</link>
                <dc:creator><![CDATA[A.P. Singh]]></dc:creator>
                <description><![CDATA[Lawmakers examined community forest rights legislation.]]></description>
                <pubDate>Thu, 19 Nov 2026 08:05:00 +0000</pubDate>
            </item>
            <item>
                <title>Nickel linked to deforestation in Indonesia traded on London Metal Exchange, says report</title>
                <link>https://news.mongabay.com/short-article/2026/11/nickel-deforestation-indonesia/</link>
                <dc:creator><![CDATA[Naina Rao]]></dc:creator>
                <description><![CDATA[Indonesian regulators and trade monitors face scrutiny over rainforest deforestation linked to industrial supply chains.]]></description>
                <pubDate>Thu, 19 Nov 2026 08:00:00 +0000</pubDate>
            </item>
        </channel></rss>`;

    const kept = parseRssItems(mongabayMixedXml, {
        sourceName: 'Mongabay',
        fundingLabel: 'Nonprofit conservation journalism (CC BY-ND 4.0)',
        attributionUrl: 'https://news.mongabay.com/',
        requireAuthor: true,
        excludeWireAuthors: true,
        maxItems: 12,
        now: fixedNow,
    });
    assert.equal(kept.length, 2, 'Mongabay must drop wire agencies and compound AP/AFP/Reuters bylines while keeping ordinary initials like A.P. Singh');
    assert.deepEqual(kept.map(item => item.author), ['A.P. Singh', 'Naina Rao']);

    const globalQuery = {
        id: 'global-climate-resources',
        region: 'Global / Transnational',
        issueHints: ['Climate & Resources'],
        fallbackCoords: null,
    };

    const videoShort = assessArticle({
        title: 'How one tiny island made conservation work',
        description: "Out in the Bristol Channel, nestled between Wales and England, the rugged island of Lundy is one of the UK's most pioneering conservation stories. Watch the full story.",
        link: 'https://news.mongabay.com/short-article/2026/11/how-one-tiny-island-made-conservation-work/',
        date: '2026-11-19',
        source: 'Mongabay',
        author: 'Sandy Watt',
        fundingLabel: 'Nonprofit conservation journalism (CC BY-ND 4.0)',
        attributionUrl: 'https://news.mongabay.com/',
    }, globalQuery, { scraperSource: 'public-rss', isConfiguredFeed: true });
    assert.equal(videoShort, null, 'Off-topic video short with Watch the full story must be dropped');

    const conservationOnly = assessArticle({
        title: 'How one tiny island made conservation work',
        description: 'Conservation volunteers counted seabird populations on a small UK island this summer.',
        link: 'https://news.mongabay.com/short-article/2026/11/how-one-tiny-island-made-conservation-work/',
        date: '2026-11-19',
        source: 'Mongabay',
        author: 'Sandy Watt',
    }, globalQuery, { scraperSource: 'public-rss', isConfiguredFeed: true });
    assert.equal(conservationOnly, null, 'Pure conservation piece with no political or policy actor must be dropped');

    const policyConservation = assessArticle({
        title: 'Nickel linked to deforestation in Indonesia traded on London Metal Exchange, says report',
        description: 'Government regulators and Indigenous leaders challenged mining deforestation permits.',
        link: 'https://news.mongabay.com/short-article/2026/11/nickel-deforestation-indonesia/',
        date: '2026-11-19',
        source: 'Mongabay',
        author: 'Naina Rao',
        fundingLabel: 'Nonprofit conservation journalism (CC BY-ND 4.0)',
        attributionUrl: 'https://news.mongabay.com/',
    }, globalQuery, { scraperSource: 'public-rss', isConfiguredFeed: true });
    assert.ok(policyConservation, 'Original policy/deforestation reporting by Mongabay must be kept');
    assert.equal(policyConservation.coverage.sourceRole, 'environmental-news');
    assert.equal(policyConservation.coverage.sourceRoleLabel, 'Environmental & conservation journalism');
});

test('Demonym matching pins Indonesian and Yemeni headlines, covers all 193 UN member states, and avoids ordinary-word collisions', () => {
    const {
        SPECIFIC_PLACE_COORDS,
        UN_MEMBER_DEMONYMS,
        UN_MEMBER_STATE_DEMONYMS,
        resolveCoords,
    } = require('../_shared/intel-normalization');

    const globalQuery = {
        id: 'global-governance',
        region: 'Global / Transnational',
        issueHints: ['Governance & Rights'],
        fallbackCoords: null,
    };

    const indonesianArticle = assessArticle({
        title: 'In win against impunity, Indonesian court orders the reform of Military Justice Law',
        description: 'Judges ordered parliament to revise jurisdiction over military abuses.',
        link: 'https://globalvoices.org/2026/11/17/in-win-against-impunity-indonesian-court-orders-the-reform-of-military-justice-law/',
        date: '2026-11-17',
        source: 'Global Voices',
        author: 'Mong Palatino',
    }, globalQuery, { scraperSource: 'public-rss', isConfiguredFeed: true });
    assert.ok(indonesianArticle, 'Indonesian court headline must pass relevance');
    assert.equal(indonesianArticle.coverage.matchedPlace, 'indonesia');
    assert.equal(indonesianArticle.coverage.locationPrecision, 'named-place');
    assert.equal(indonesianArticle.Latitude, '-0.8');
    assert.equal(indonesianArticle.Longitude, '113.9');
    assert.equal(indonesianArticle.coverage.region, 'Asia-Pacific');

    const yemeniArticle = assessArticle({
        title: "'I tell my son it's just fireworks': Life inside Yemeni city besieged by Houthis",
        description: 'Civilians endure artillery strikes and blockade inside the besieged city.',
        link: 'https://www.bbc.co.uk/news/articles/cx7v2d8q879eo',
        date: '2026-11-20',
        source: 'BBC News',
    }, globalQuery, { scraperSource: 'public-rss', isConfiguredFeed: true });
    assert.ok(yemeniArticle, 'Yemeni siege headline must pass relevance');
    assert.equal(yemeniArticle.coverage.matchedPlace, 'yemen');
    assert.equal(yemeniArticle.coverage.locationPrecision, 'named-place');
    assert.equal(yemeniArticle.Latitude, '15.6');
    assert.equal(yemeniArticle.Longitude, '48.5');
    assert.equal(yemeniArticle.coverage.region, 'Middle East & North Africa');

    // Demonym-only headline must resolve its own region even when snippet names another region
    const demonymOverSnippetRegion = assessArticle({
        title: 'Yemeni city besieged by Houthis amid humanitarian talks',
        description: 'UK officials monitor humanitarian aid delivery.',
        link: 'https://www.bbc.co.uk/news/articles/yemen-uk-aid-test',
        date: '2026-11-20',
        source: 'BBC News',
    }, globalQuery, { scraperSource: 'public-rss', isConfiguredFeed: true });
    assert.ok(demonymOverSnippetRegion);
    assert.equal(demonymOverSnippetRegion.coverage.matchedPlace, 'yemen');
    assert.equal(demonymOverSnippetRegion.coverage.region, 'Middle East & North Africa');

    // Unmapped Global / Transnational stories must stay unpinned and not receive a bogus explicit-region bonus
    const unmappedGlobal = assessArticle({
        title: 'Diplomats negotiate treaty enforcement and sanctions rules',
        description: 'Oversight talks examined compliance.',
        link: 'https://www.bbc.co.uk/news/articles/unmapped-global-oversight',
        date: '2026-11-20',
        source: 'BBC News',
    }, globalQuery, { scraperSource: 'public-rss', isConfiguredFeed: true });
    const explicitGlobal = assessArticle({
        title: 'Diplomats negotiate treaty enforcement and sanctions rules',
        description: 'Global talks examined compliance.',
        link: 'https://www.bbc.co.uk/news/articles/explicit-global-oversight',
        date: '2026-11-20',
        source: 'BBC News',
    }, globalQuery, { scraperSource: 'public-rss', isConfiguredFeed: true });
    assert.ok(unmappedGlobal && explicitGlobal);
    assert.equal(unmappedGlobal.coverage.locationPrecision, 'global-unmapped');
    assert.equal(unmappedGlobal.Latitude, null);
    assert.equal(explicitGlobal.coverage.relevanceScore - unmappedGlobal.coverage.relevanceScore, 5);

    // First-in-title ordering with demonyms and multi-word specificity
    assert.equal(resolveCoords('Ukrainian envoys meet French officials', '').matchedPlace, 'ukraine');
    assert.equal(resolveCoords('American Samoan leaders challenge seabed lease auction', '').matchedPlace, 'american samoa');
    assert.equal(resolveCoords('US leases American Samoan seabed for mining in auction', '').matchedPlace, 'united states');
    assert.equal(resolveCoords('South Korean lawmakers debate North Korean sanctions', '').matchedPlace, 'south korea');
    assert.equal(resolveCoords('Equatorial Guinean delegation arrives at AU summit', '').matchedPlace, 'equatorial guinea');

    // Ordinary-word and geographic collision guards
    assert.equal(resolveCoords('Factories regulate chemicals in nail polish and shoes', '').matchedPlace, null);
    assert.equal(resolveCoords('Groups agree to go dutch on climate fund costs', '').matchedPlace, null);
    assert.equal(resolveCoords('Latin American trade bloc reviews tariffs', '').matchedPlace, 'latin america');
    assert.equal(resolveCoords('Vessels cross Indian Ocean shipping lanes', '').matchedPlace, null);
    assert.equal(resolveCoords('Trade dispute hits French fries and agricultural imports', '').matchedPlace, null);
    assert.equal(resolveCoords('Polish lawmakers pass judicial reform bill', '').matchedPlace, 'poland');
    assert.equal(resolveCoords('Dutch court rules on offshore climate emissions', '').matchedPlace, 'netherlands');

    // Verify all 193 UN member states exist and resolve via UN_MEMBER_DEMONYMS
    const memberKeys = Object.keys(UN_MEMBER_STATE_DEMONYMS);
    assert.equal(memberKeys.length, 193, 'Must map all 193 UN member states');
    for (const countryKey of memberKeys) {
        assert.ok(countryKey in SPECIFIC_PLACE_COORDS, `Missing coordinates for UN member ${countryKey}`);
        for (const demonym of UN_MEMBER_STATE_DEMONYMS[countryKey]) {
            assert.ok(UN_MEMBER_DEMONYMS[demonym.toLowerCase()], `Exported UN_MEMBER_DEMONYMS missing ${demonym}`);
            const resolved = resolveCoords(`${demonym} government signs agreement`, '');
            const validMatch = resolved.matchedPlace === countryKey
                || (countryKey === 'republic of the congo' && resolved.matchedPlace === 'democratic republic of the congo')
                || (countryKey === 'dominica' && resolved.matchedPlace === 'dominican republic');
            assert.equal(validMatch, true, `Demonym "${demonym}" resolved to ${resolved.matchedPlace} instead of ${countryKey}`);
        }
    }
});
