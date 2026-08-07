const test = require('node:test');
const assert = require('node:assert/strict');

const { _test } = require('../fetch-intel');

test('curated items are explicitly dated editorial context rather than live intel', () => {
    assert.ok(_test.EDITORIAL_CONTEXT.length > 0);
    for (const item of _test.EDITORIAL_CONTEXT) {
        assert.equal(item.isLive, false);
        assert.equal(item.isEditorial, true);
        assert.equal(item._contentStatus, 'editorial-archive');
        assert.match(item.Timeline, /^EDITORIAL CONTEXT/);
    }
});

test('coordinate inference is deterministic for identical text', () => {
    assert.deepEqual(_test.getCoords('Diplomatic talks involving Ukraine'), _test.getCoords('Diplomatic talks involving Ukraine'));
});
