import test from 'node:test';
import assert from 'node:assert/strict';

import { indexSourceHealth, shouldPreferAlternate, sourceHealthLabel } from '../sourceHealth.mjs';

test('briefing source health recommends alternates only for restricted or broken primaries', () => {
    const indexed = indexSourceHealth({ results: [
        { url: 'https://example.org/restricted', status: 'restricted', httpStatus: 403 },
        { url: 'https://example.org/healthy', status: 'healthy', httpStatus: 200 },
    ] });

    assert.equal(shouldPreferAlternate(indexed.get('https://example.org/restricted')), true);
    assert.equal(shouldPreferAlternate(indexed.get('https://example.org/healthy')), false);
    assert.equal(sourceHealthLabel(indexed.get('https://example.org/restricted')), 'Publisher may restrict access');
});
