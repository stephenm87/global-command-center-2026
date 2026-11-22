const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let modPromise;
function loadDeepScan() {
    if (!modPromise) {
        modPromise = import(pathToFileURL(path.resolve(__dirname, '../deep-scan.mjs')).href);
    }
    return modPromise;
}

function createMemoryStore(backing = new Map(), { throwOnGet = false } = {}) {
    return {
        async get(key) {
            if (throwOnGet) throw new Error('Blobs read error');
            return backing.has(key) ? JSON.parse(JSON.stringify(backing.get(key))) : null;
        },
        async setJSON(key, value) {
            backing.set(key, JSON.parse(JSON.stringify(value)));
        },
    };
}

test('deep-scan preserves at least 15,000 characters including conclusion tail for downstream AI briefs', async () => {
    const { _test } = await loadDeepScan();
    assert.ok(_test, 'deep-scan should expose _test helpers');
    assert.ok(_test.MAX_SCRAPE_CONTENT_LENGTH >= 15000);

    const mediumArticle = `INTRO ${'x'.repeat(13000)} CONCLUSION_SECTION`;
    const preservedMedium = _test.selectScrapedMarkdown(mediumArticle);
    assert.equal(preservedMedium, mediumArticle);

    const longArticle = `LEAD_START ${'m'.repeat(20000)} FINAL_CONCLUSION_PARAGRAPH`;
    const preservedLong = _test.selectScrapedMarkdown(longArticle);
    assert.ok(preservedLong.length >= 12000, 'Selected markdown must feed ai-summary 12k window');
    assert.ok(preservedLong.length <= _test.MAX_SCRAPE_CONTENT_LENGTH + 80);
    assert.match(preservedLong, /^LEAD_START/);
    assert.match(preservedLong, /FINAL_CONCLUSION_PARAGRAPH$/);
});

test('deep-scan SSRF validator upgrades http:// to https:// and blocks private IPs, non-standard ports, and rebinding targets', async () => {
    const { _test } = await loadDeepScan();
    assert.equal(_test.normalizeOutboundUrl('http://www.reuters.com/world/article'), 'https://www.reuters.com/world/article');
    assert.equal(_test.normalizeOutboundUrl('http://www.reuters.com:80/world/article'), 'https://www.reuters.com/world/article');
    assert.equal(_test.isValidUrl('https://www.reuters.com/world/article'), true);
    assert.equal(_test.isValidUrl('http://www.reuters.com/world/article'), true, 'http URLs upgrade cleanly to https');
    assert.equal(_test.isValidUrl('https://www.reuters.com:8443/world/article'), false, 'non-443 port must be rejected');
    assert.equal(_test.isValidUrl('ftp://www.reuters.com/world/article'), false, 'non-http(s) scheme must be rejected');
    assert.equal(_test.isValidUrl(['https://www.reuters.com/world/article']), false, 'non-string array must be rejected');
    assert.equal(_test.isValidUrl('https://127.0.0.1/secret'), false, 'loopback IPv4 literal must be rejected');
    assert.equal(_test.isValidUrl('https://198.18.0.1/secret'), false, 'benchmarking IPv4 range must be rejected');
    assert.equal(_test.isValidUrl('https://[::ffff:127.0.0.1]/secret'), false, 'IPv4-mapped loopback IPv6 literal must be rejected');
    assert.equal(_test.isValidUrl('https://[64:ff9b::7f00:1]/secret'), false, 'NAT64 IPv6 range must be rejected');
    assert.equal(_test.isValidUrl('https://127.0.0.1.nip.io/secret'), false, 'rebinding suffix must be rejected');
    assert.equal(_test.isValidUrl('https://user:pass@example.com/path'), false, 'embedded credentials must be rejected');

    const rebindingLookup = async () => [{ address: '169.254.169.254', family: 4 }];
    const publicLookup = async () => [{ address: '93.184.216.34', family: 4 }];

    assert.equal(await _test.validateOutboundUrl('https://evil.example.org/article', rebindingLookup), false);
    assert.equal(await _test.validateOutboundUrl('http://www.example.org/article', publicLookup), true);
});

test('handleDeepScan enforces 4 KiB body limit, rejects multi-URL payloads, respects daily cap & fail-closed Blobs, and sanitizes provider errors', async () => {
    const { handleDeepScan, _test } = await loadDeepScan();
    const originalFetch = global.fetch;
    const origError = console.error;
    const logged = [];
    console.error = (...args) => logged.push(args.join(' '));

    let firecrawlCalls = 0;
    const baseEnv = {
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
        FIRECRAWL_API_KEY: 'super-secret-firecrawl-key',
        DEEP_SCAN_DAILY_CAP: '1',
    };
    const publicLookup = async () => [{ address: '93.184.216.34', family: 4 }];

    try {
        global.fetch = async () => ({
            ok: true,
            json: async () => ({ id: 'scan-user', email: 'student@school.edu' }),
        });

        const store = createMemoryStore();

        // 1. Oversized body (> 4 KiB) rejected with 413 before parsing or calling Firecrawl
        const r413 = await handleDeepScan(
            new Request('https://example.org/.netlify/functions/deep-scan', {
                method: 'POST',
                headers: { authorization: 'Bearer tok', 'content-type': 'application/json' },
                body: JSON.stringify({ url: `https://example.org/${'a'.repeat(_test.MAX_BODY_BYTES + 200)}` }),
            }),
            null,
            {
                env: baseEnv,
                lookupFn: publicLookup,
                securityOptions: { store },
                fetchImpl: async () => {
                    firecrawlCalls += 1;
                    throw new Error('Should not be called');
                },
            },
        );
        assert.equal(r413.status, 413);
        assert.equal(firecrawlCalls, 0);

        // 2. Rejects multi-URL requests
        const rMulti = await handleDeepScan(
            new Request('https://example.org/.netlify/functions/deep-scan', {
                method: 'POST',
                headers: { authorization: 'Bearer tok', 'content-type': 'application/json' },
                body: JSON.stringify({ urls: ['https://example.org/a', 'https://example.org/b'] }),
            }),
            null,
            {
                env: baseEnv,
                lookupFn: publicLookup,
                securityOptions: { store },
                fetchImpl: async () => {
                    firecrawlCalls += 1;
                    throw new Error('Should not be called');
                },
            },
        );
        assert.equal(rMulti.status, 400);
        assert.equal(firecrawlCalls, 0);

        // 3. Second allowed request fails daily cap (cap=1 consumed by rMulti after passing security) -> 429 zero Firecrawl call
        const r429 = await handleDeepScan(
            new Request('https://example.org/.netlify/functions/deep-scan', {
                method: 'POST',
                headers: { authorization: 'Bearer tok', 'content-type': 'application/json' },
                body: JSON.stringify({ url: 'https://example.org/article' }),
            }),
            null,
            {
                env: baseEnv,
                lookupFn: publicLookup,
                securityOptions: { store },
                fetchImpl: async () => {
                    firecrawlCalls += 1;
                    throw new Error('Should not be called');
                },
            },
        );
        assert.equal(r429.status, 429);
        assert.equal(firecrawlCalls, 0);

        // 4. Blobs store failure -> 503 zero Firecrawl call
        const r503 = await handleDeepScan(
            new Request('https://example.org/.netlify/functions/deep-scan', {
                method: 'POST',
                headers: { authorization: 'Bearer tok', 'content-type': 'application/json' },
                body: JSON.stringify({ url: 'https://example.org/article' }),
            }),
            null,
            {
                env: baseEnv,
                lookupFn: publicLookup,
                securityOptions: { store: createMemoryStore(new Map(), { throwOnGet: true }) },
                fetchImpl: async () => {
                    firecrawlCalls += 1;
                    throw new Error('Should not be called');
                },
            },
        );
        assert.equal(r503.status, 503);
        assert.equal(firecrawlCalls, 0);

        // 5. Upstream error sanitizes raw body and key
        const r500 = await handleDeepScan(
            new Request('https://example.org/.netlify/functions/deep-scan', {
                method: 'POST',
                headers: { authorization: 'Bearer tok', 'content-type': 'application/json' },
                body: JSON.stringify({ url: 'https://example.org/article' }),
            }),
            null,
            {
                env: { ...baseEnv, DEEP_SCAN_DAILY_CAP: '100' },
                lookupFn: publicLookup,
                securityOptions: { store: createMemoryStore() },
                fetchImpl: async () => {
                    firecrawlCalls += 1;
                    return new Response('RAW_FIRECRAWL_SECRET_BODY super-secret-firecrawl-key', { status: 502 });
                },
            },
        );
        assert.equal(r500.status, 500);
        assert.equal(firecrawlCalls, 1);
        const body = await r500.text();
        assert.ok(!body.includes('RAW_FIRECRAWL_SECRET_BODY'));
        assert.ok(!body.includes('super-secret-firecrawl-key'));
        assert.ok(!logged.join('\n').includes('RAW_FIRECRAWL_SECRET_BODY'));
        assert.ok(!logged.join('\n').includes('super-secret-firecrawl-key'));
    } finally {
        global.fetch = originalFetch;
        console.error = origError;
    }
});
