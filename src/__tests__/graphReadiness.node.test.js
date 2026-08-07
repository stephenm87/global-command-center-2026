const test = require('node:test');
const assert = require('node:assert/strict');

test('does not reheat before the graph engine is ready', async () => {
    const { reheatGraphWhenReady } = await import('../graphReadiness.mjs');
    let calls = 0;
    const graphRef = { current: { d3ReheatSimulation: () => { calls += 1; } } };

    assert.equal(reheatGraphWhenReady({ current: false }, graphRef), false);
    assert.equal(calls, 0);
});

test('reheats exactly once after the graph engine is ready', async () => {
    const { reheatGraphWhenReady } = await import('../graphReadiness.mjs');
    let calls = 0;
    const graph = { d3ReheatSimulation: () => { calls += 1; } };

    assert.equal(reheatGraphWhenReady({ current: true }, graph), true);
    assert.equal(calls, 1);
});

test('fails closed when the graph instance is unavailable', async () => {
    const { reheatGraphWhenReady } = await import('../graphReadiness.mjs');

    assert.equal(reheatGraphWhenReady({ current: true }, { current: null }), false);
});
