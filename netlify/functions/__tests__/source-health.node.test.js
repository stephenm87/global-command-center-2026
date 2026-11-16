const test = require('node:test');
const assert = require('node:assert/strict');

const { checkTarget, checkTargets, classifyStatus, summarizeHealth } = require('../_shared/source-health');

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

test('checkTargets deduplicates identical URLs and enforces an overall deadlineMs without losing completed results', async () => {
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
    assert.equal(deduped[0].id, 'case-1:core:0');
    assert.equal(deduped[1].id, 'case-2:core:1');
    assert.equal(deduped[0].status, 'healthy');
    assert.equal(deduped[1].status, 'healthy');

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
