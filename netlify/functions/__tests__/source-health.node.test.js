const test = require('node:test');
const assert = require('node:assert/strict');

const { checkTarget, classifyStatus, summarizeHealth } = require('../_shared/source-health');

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
