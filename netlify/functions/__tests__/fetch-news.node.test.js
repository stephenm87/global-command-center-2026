const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let modPromise;
function loadFetchNews() {
    if (!modPromise) {
        modPromise = import(pathToFileURL(path.resolve(__dirname, '../fetch-news.mjs')).href);
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

test('fetch-news sanitizeQuery clamps to 200 characters and strips control/angle chars', async () => {
    const { _test } = await loadFetchNews();
    assert.equal(_test.MAX_QUERY_LENGTH, 200);
    assert.equal(_test.FIXED_RESULT_COUNT, 10);

    const dirty = `sudan<script>{alert} ${'a'.repeat(300)}`;
    const sanitized = _test.sanitizeQuery(dirty);
    assert.ok(sanitized.length <= 200);
    assert.ok(!/[<>]/.test(sanitized));
});

test('handleFetchNews enforces 4 KiB body limit, fixed num:10 result count, daily cap, fail-closed Blobs, and sanitized error responses', async () => {
    const { handleFetchNews, _test } = await loadFetchNews();
    const originalFetch = global.fetch;
    const origError = console.error;
    const logged = [];
    console.error = (...args) => logged.push(args.join(' '));

    let serperCalls = 0;
    let lastSerperPayload = null;
    const baseEnv = {
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
        SERPER_API_KEY: 'super-secret-serper-key',
        FETCH_NEWS_DAILY_CAP: '1',
    };

    try {
        global.fetch = async () => ({
            ok: true,
            json: async () => ({ id: 'news-user', email: 'student@school.edu' }),
        });

        const store = createMemoryStore();

        // 0. Approved-origin OPTIONS preflight returns 204 null-body Response cleanly
        const rOptions = await handleFetchNews(
            new Request('https://example.org/.netlify/functions/fetch-news', {
                method: 'OPTIONS',
                headers: { origin: 'http://localhost:5173' },
            }),
            null,
            { env: baseEnv, securityOptions: { store } },
        );
        assert.equal(rOptions.status, 204);
        assert.equal(rOptions.headers.get('access-control-allow-origin'), 'http://localhost:5173');

        // 1. Oversized body (> 4 KiB) rejected with 413 before parsing or calling Serper
        const r413 = await handleFetchNews(
            new Request('https://example.org/.netlify/functions/fetch-news', {
                method: 'POST',
                headers: { authorization: 'Bearer tok', 'content-type': 'application/json' },
                body: JSON.stringify({ query: 'x'.repeat(_test.MAX_BODY_BYTES + 200) }),
            }),
            null,
            {
                env: baseEnv,
                securityOptions: { store },
                fetchImpl: async () => {
                    serperCalls += 1;
                    throw new Error('Should not be called');
                },
            },
        );
        assert.equal(r413.status, 413);
        assert.equal(serperCalls, 0);

        // 2. Fixed result count num=10 enforced even if caller requests num=100; slices <= 10 articles
        const r200 = await handleFetchNews(
            new Request('https://example.org/.netlify/functions/fetch-news', {
                method: 'POST',
                headers: { authorization: 'Bearer tok', 'content-type': 'application/json' },
                body: JSON.stringify({ query: 'Sudan humanitarian access', num: 100, limit: 50 }),
            }),
            null,
            {
                env: baseEnv,
                securityOptions: { store },
                fetchImpl: async (_url, init) => {
                    serperCalls += 1;
                    lastSerperPayload = JSON.parse(init.body);
                    return new Response(JSON.stringify({
                        news: Array.from({ length: 15 }, (_, idx) => ({
                            title: `Sudan report ${idx + 1}`,
                            snippet: 'Humanitarian corridor update in Sudan.',
                            link: `https://example.org/sudan/${idx + 1}`,
                            source: 'Relief Desk',
                            date: 'Today',
                        })),
                    }), { status: 200 });
                },
            },
        );
        assert.equal(r200.status, 200);
        assert.equal(serperCalls, 1);
        assert.equal(lastSerperPayload.num, _test.FIXED_RESULT_COUNT);
        const okJson = await r200.json();
        assert.equal(okJson.nodes.length, 10);

        // 3. Daily cap reached -> 429 zero Serper calls
        const r429 = await handleFetchNews(
            new Request('https://example.org/.netlify/functions/fetch-news', {
                method: 'POST',
                headers: { authorization: 'Bearer tok2', 'content-type': 'application/json' },
                body: JSON.stringify({ query: 'Sudan' }),
            }),
            null,
            {
                env: baseEnv,
                securityOptions: { store },
                fetchImpl: async () => {
                    serperCalls += 1;
                    throw new Error('Should not be called');
                },
            },
        );
        assert.equal(r429.status, 429);
        assert.equal(serperCalls, 1);

        // 4. Blobs store throws -> 503 zero Serper calls
        const r503Store = await handleFetchNews(
            new Request('https://example.org/.netlify/functions/fetch-news', {
                method: 'POST',
                headers: { authorization: 'Bearer tok', 'content-type': 'application/json' },
                body: JSON.stringify({ query: 'Sudan' }),
            }),
            null,
            {
                env: baseEnv,
                securityOptions: { store: createMemoryStore(new Map(), { throwOnGet: true }) },
                fetchImpl: async () => {
                    serperCalls += 1;
                    throw new Error('Should not be called');
                },
            },
        );
        assert.equal(r503Store.status, 503);
        assert.equal(serperCalls, 1);

        // 5. Missing SERPER_API_KEY never leaks secret env var name; upstream failure never leaks raw body/key
        const rMissingKey = await handleFetchNews(
            new Request('https://example.org/.netlify/functions/fetch-news', {
                method: 'POST',
                headers: { authorization: 'Bearer tok', 'content-type': 'application/json' },
                body: JSON.stringify({ query: 'Sudan' }),
            }),
            null,
            {
                env: {
                    SUPABASE_URL: 'https://example.supabase.co',
                    SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
                },
                securityOptions: { store: createMemoryStore() },
            },
        );
        assert.equal(rMissingKey.status, 503);
        assert.ok(!(await rMissingKey.text()).includes('SERPER_API_KEY'));

        const r500 = await handleFetchNews(
            new Request('https://example.org/.netlify/functions/fetch-news', {
                method: 'POST',
                headers: { authorization: 'Bearer tok', 'content-type': 'application/json' },
                body: JSON.stringify({ query: 'Sudan' }),
            }),
            null,
            {
                env: { ...baseEnv, FETCH_NEWS_DAILY_CAP: '300' },
                securityOptions: { store: createMemoryStore() },
                fetchImpl: async () => new Response('RAW_SERPER_SECRET_BODY super-secret-serper-key', { status: 502 }),
            },
        );
        assert.equal(r500.status, 500);
        const body500 = await r500.text();
        assert.ok(!body500.includes('RAW_SERPER_SECRET_BODY'));
        assert.ok(!body500.includes('super-secret-serper-key'));
        assert.ok(!logged.join('\n').includes('RAW_SERPER_SECRET_BODY'));
        assert.ok(!logged.join('\n').includes('super-secret-serper-key'));
    } finally {
        global.fetch = originalFetch;
        console.error = origError;
    }
});
