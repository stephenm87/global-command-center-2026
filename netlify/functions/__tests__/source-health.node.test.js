const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const { checkTarget, checkTargets, classifyStatus, summarizeHealth } = require('../_shared/source-health');
const { protectBackgroundCron } = require('../security');

test('source health distinguishes healthy, restricted, broken, and uncertain responses', () => {
    assert.equal(classifyStatus(200), 'healthy');
    assert.equal(classifyStatus(302), 'healthy');
    assert.equal(classifyStatus(403), 'restricted');
    assert.equal(classifyStatus(404), 'broken');
    assert.equal(classifyStatus(500), 'unknown');
});

test('source health retries HEAD-incompatible publishers with a range GET', async () => {
    const methods = [];
    const result = await checkTarget({ id: 'source-1', url: 'https://example.org/report' }, async (_url, init) => {
        methods.push(init.method);
        return { status: init.method === 'HEAD' ? 405 : 206 };
    });

    assert.deepEqual(methods, ['HEAD', 'GET']);
    assert.equal(result.status, 'healthy');
    assert.deepEqual(summarizeHealth([result]), { healthy: 1, restricted: 0, broken: 0, unknown: 0 });
});

test('source health supports configurable timeoutMs and classifies both AbortError and TimeoutError as timeout', async () => {
    const abortResult = await checkTarget(
        { id: 'slow-abort', url: 'https://example.org/slow1' },
        async (_url, init) => {
            assert.ok(init.signal, 'Expected AbortSignal');
            const err = new Error('Aborted');
            err.name = 'AbortError';
            throw err;
        },
        { timeoutMs: 1200 }
    );
    const timeoutResult = await checkTarget(
        { id: 'slow-timeout', url: 'https://example.org/slow2' },
        async () => {
            const err = new Error('Timed out');
            err.name = 'TimeoutError';
            throw err;
        },
        { timeoutMs: 1200 }
    );

    assert.equal(abortResult.status, 'unknown');
    assert.equal(abortResult.reason, 'timeout');
    assert.equal(timeoutResult.status, 'unknown');
    assert.equal(timeoutResult.reason, 'timeout');
});

test('checkTargets deduplicates identical URLs, caps per-host concurrency, and enforces an overall deadlineMs', async () => {
    let fetchCalls = 0;
    const deduped = await checkTargets(
        [
            { id: 'case-1:core:0', url: 'https://un.org/shared-docket' },
            { id: 'case-2:core:1', url: 'https://un.org/shared-docket' },
            { id: 'case-3:core:0', url: 'https://icj-cij.org/case/171' },
        ],
        {
            concurrency: 4,
            fetchImpl: async () => {
                fetchCalls += 1;
                return { status: 200 };
            },
        }
    );
    assert.equal(fetchCalls, 2, 'Shared URL across two targets must be fetched once');
    assert.equal(deduped.length, 3);
    assert.equal(deduped[0].status, 'healthy');
    assert.equal(deduped[1].status, 'healthy');

    // Verify maxPerHost <= 2 even when overall concurrency = 6 and all 5 URLs share one host
    let currentInFlight = 0;
    let peakSameHostInFlight = 0;
    await checkTargets(
        [1, 2, 3, 4, 5].map(n => ({ id: `same-${n}`, url: `https://same-host.example/${n}` })),
        {
            concurrency: 6,
            maxPerHost: 2,
            fetchImpl: async () => {
                currentInFlight += 1;
                peakSameHostInFlight = Math.max(peakSameHostInFlight, currentInFlight);
                await new Promise(resolve => setTimeout(resolve, 20));
                currentInFlight -= 1;
                return { status: 200 };
            },
        }
    );
    assert.ok(peakSameHostInFlight <= 2, `Expected maxPerHost <= 2, observed ${peakSameHostInFlight}`);

    const bounded = await checkTargets(
        [
            { id: 'fast-1', url: 'https://fast.example/1' },
            { id: 'slow-2', url: 'https://slow1.example/2' },
            { id: 'slow-3', url: 'https://slow2.example/3' },
        ],
        {
            concurrency: 1,
            timeoutMs: 500,
            deadlineMs: 80,
            fetchImpl: async url => {
                if (String(url).includes('fast.example')) {
                    return { status: 200 };
                }
                await new Promise(resolve => setTimeout(resolve, 90));
                return { status: 200 };
            },
        }
    );
    assert.equal(bounded[0].status, 'healthy');
    assert.equal(bounded[2].status, 'unknown');
    assert.equal(bounded[2].reason, 'deadline-exceeded');
});

test('protectBackgroundCron, runFullSourceHealthRefresh, and dispatchOrRunInline cover auth, archival filtering, carry-forward, non-2xx/abort fallbacks, and 36h staleness guard', async () => {
    assert.equal(protectBackgroundCron({ method: 'GET' }, { secret: 'super-secret-cron-token-2026' }).status, 405);
    assert.equal(protectBackgroundCron({ method: 'POST' }, { secret: 'short' }).status, 503);
    assert.equal(
        protectBackgroundCron(
            new Request('https://example.org/.netlify/functions/refresh-source-health-background', {
                method: 'POST',
                headers: { 'x-cron-secret': 'wrong-secret-token-2026' },
            }),
            { secret: 'super-secret-cron-token-2026' }
        ).status,
        403
    );
    assert.equal(
        protectBackgroundCron(
            new Request('https://example.org/.netlify/functions/refresh-source-health-background', {
                method: 'POST',
                headers: { 'x-cron-secret': 'super-secret-cron-token-2026' },
            }),
            { secret: 'super-secret-cron-token-2026' }
        ).ok,
        true
    );

    const bgMod = await import(pathToFileURL(path.resolve(__dirname, '../refresh-source-health-background.mjs')).href);
    let savedSnapshot = null;
    const bgSnapshot = await bgMod.runFullSourceHealthRefresh({
        targets: [
            { id: 'active-1', url: 'https://fast.example/ok', lifecycle: 'active' },
            { id: 'active-mid', url: 'https://mid.example/spend-budget', lifecycle: 'active' },
            { id: 'active-slow', url: 'https://slow.example/defer', lifecycle: 'active' },
            { id: 'archived-1', url: 'https://archived.example/skip', lifecycle: 'archived' },
        ],
        concurrency: 1,
        timeoutMs: 300,
        deadlineMs: 80,
        fetchImpl: async url => {
            if (String(url).includes('archived.example')) {
                throw new Error('Archived target must never be probed');
            }
            if (String(url).includes('fast.example')) return { status: 200 };
            await new Promise(resolve => setTimeout(resolve, 65));
            return { status: 200 };
        },
        readPrev: async () => ({
            results: [{ id: 'active-slow', url: 'https://slow.example/defer', status: 'restricted', httpStatus: 403, checkedAt: '2026-11-16T00:00:00Z' }],
        }),
        writeNext: async snap => { savedSnapshot = snap; },
    });
    assert.equal(bgSnapshot.workerMode, 'background-15m');
    assert.equal(bgSnapshot.targetCount, 3, 'Archived targets must be excluded');
    assert.equal(bgSnapshot.incompleteCount, 1);
    assert.equal(bgSnapshot.results[2].status, 'restricted', 'Deadline-deferred target must carry forward prior non-unknown status');
    assert.equal(bgSnapshot.results[2].carriedForward, true);
    assert.equal(savedSnapshot.workerMode, 'background-15m');

    const refreshMod = await import(pathToFileURL(path.resolve(__dirname, '../refresh-source-health.mjs')).href);
    const nowMs = Date.parse('2026-11-17T00:00:00Z');
    const freshPrev = { checkedAt: '2026-11-16T12:00:00Z' };
    const stalePrev = { checkedAt: '2026-11-14T00:00:00Z' };

    // 1. Fresh snapshot + 202 dispatch -> background-dispatched only
    let dispatchedHeaders = null;
    const dispatched = await refreshMod.dispatchOrRunInline({
        siteUrl: 'https://globalcommandcenter2026.netlify.app',
        cronSecret: 'super-secret-cron-token-2026',
        previousSnapshot: freshPrev,
        nowMs,
        fetchImpl: async (_url, init) => {
            dispatchedHeaders = init.headers;
            return { status: 202 };
        },
        runInline: async () => { throw new Error('Should not run inline when snapshot is fresh and dispatch returns 202'); },
    });
    assert.equal(dispatched.mode, 'background-dispatched');
    assert.equal(dispatchedHeaders['x-cron-secret'], 'super-secret-cron-token-2026');

    // 2. Stale (>36h) or missing snapshot + 202 dispatch -> also runs inline safety refresh
    let staleGuardRuns = 0;
    const staleDispatched = await refreshMod.dispatchOrRunInline({
        siteUrl: 'https://globalcommandcenter2026.netlify.app',
        cronSecret: 'super-secret-cron-token-2026',
        previousSnapshot: stalePrev,
        nowMs,
        fetchImpl: async () => ({ status: 202 }),
        runInline: async () => { staleGuardRuns += 1; return { ok: true }; },
    });
    assert.equal(staleDispatched.mode, 'background-dispatched-with-stale-guard');
    assert.equal(staleGuardRuns, 1);

    // 3. Non-2xx response -> falls back to inline-bounded
    let non2xxInline = 0;
    const non2xxResult = await refreshMod.dispatchOrRunInline({
        siteUrl: 'https://globalcommandcenter2026.netlify.app',
        cronSecret: 'super-secret-cron-token-2026',
        previousSnapshot: freshPrev,
        nowMs,
        fetchImpl: async () => ({ status: 500 }),
        runInline: async () => { non2xxInline += 1; return { ok: true }; },
    });
    assert.equal(non2xxResult.mode, 'inline-bounded');
    assert.equal(non2xxInline, 1);

    // 4. Network / abort throw -> falls back to inline-bounded
    let abortInline = 0;
    const abortResult = await refreshMod.dispatchOrRunInline({
        siteUrl: 'https://globalcommandcenter2026.netlify.app',
        cronSecret: 'super-secret-cron-token-2026',
        previousSnapshot: freshPrev,
        nowMs,
        fetchImpl: async () => {
            const err = new Error('Dispatch timed out');
            err.name = 'AbortError';
            throw err;
        },
        runInline: async () => { abortInline += 1; return { ok: true }; },
    });
    assert.equal(abortResult.mode, 'inline-bounded');
    assert.equal(abortInline, 1);

    // 5. Daily Supabase keep-alive skips cleanly when unconfigured and hits read-only REST endpoint when configured
    const skippedKeepAlive = await refreshMod.pingSupabaseKeepAlive({ supabaseUrl: '', supabaseKey: '' });
    assert.equal(skippedKeepAlive.skipped, true);

    let keepAliveReq = null;
    const okKeepAlive = await refreshMod.pingSupabaseKeepAlive({
        supabaseUrl: 'https://demo.supabase.co/',
        supabaseKey: 'sb_publishable_demo_key_12345',
        fetchImpl: async (url, init) => {
            keepAliveReq = { url, init };
            return { ok: true, status: 200 };
        },
    });
    assert.equal(okKeepAlive.ok, true);
    assert.equal(keepAliveReq.url, 'https://demo.supabase.co/rest/v1/user_data?select=key&limit=1');
    assert.equal(keepAliveReq.init.method, 'GET');
    assert.equal(keepAliveReq.init.headers.apikey, 'sb_publishable_demo_key_12345');

    const failKeepAlive = await refreshMod.pingSupabaseKeepAlive({
        supabaseUrl: 'https://demo.supabase.co',
        supabaseKey: 'sb_publishable_demo_key_12345',
        fetchImpl: async () => { throw new Error('ENOTFOUND'); },
    });
    assert.equal(failKeepAlive.ok, false);
    assert.equal(failKeepAlive.reason, 'network-error');
});
