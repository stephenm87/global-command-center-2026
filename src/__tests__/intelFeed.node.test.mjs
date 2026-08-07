import test from 'node:test';
import assert from 'node:assert/strict';

import {
    LIVE_INTEL_CATEGORY,
    filterIntelForecasts,
    getFeedEmptyState,
    mergeIntelSources,
    searchIntelForecasts,
    summarizeIntelSources,
} from '../intelFeed.mjs';

const linkedRecord = overrides => ({
    url: 'https://example.org/report',
    'Entity/Subject': 'Regional ceasefire talks',
    'Topic/Sector': 'Geopolitics / Diplomacy',
    Broad_Category: 'Geopolitics & Conflict',
    Timeline: '2026',
    ...overrides,
});

test('public fallback records remain linked references and are never relabelled as live', () => {
    const [record] = mergeIntelSources({
        publicReferenceItems: [linkedRecord({ isLive: true, Timeline: 'LIVE - Mar 2026' })],
    });

    assert.equal(record.url, 'https://example.org/report');
    assert.equal(record.isLive, false);
    assert.equal(record.isReference, true);
    assert.equal(record._contentStatus, 'public-reference');
    assert.equal(record.Timeline, 'Dated reference · Mar 2026');
    assert.deepEqual(summarizeIntelSources([record]), {
        totalItemCount: 1,
        liveItemCount: 0,
        linkedReferenceCount: 1,
        sourceMode: 'public-reference',
    });
});

test('provider-current records lead public references and exact duplicates are removed', () => {
    const providerRecord = linkedRecord({ _contentStatus: 'provider-current' });
    const distinctSharedSource = linkedRecord({ 'Entity/Subject': 'Regional aid access' });
    const records = mergeIntelSources({
        providerItems: [providerRecord],
        publicReferenceItems: [linkedRecord({}), distinctSharedSource],
    });

    assert.equal(records.length, 2);
    assert.equal(records[0].isLive, true);
    assert.equal(records[1]['Entity/Subject'], 'Regional aid access');
    assert.equal(records[1].isLive, false);
    assert.equal(summarizeIntelSources(records, { sourceMode: 'provider' }).sourceMode, 'provider');
});

test('provider static fallback records are dated references rather than live items', () => {
    const [record] = mergeIntelSources({
        providerItems: [linkedRecord({
            isLive: false,
            _contentStatus: 'static-fallback',
            Timeline: 'LIVE - Feb 2026',
        })],
        publicReferenceItems: [linkedRecord({ Timeline: 'LIVE - Feb 2026' })],
    });

    assert.equal(record.isLive, false);
    assert.equal(record.Timeline, 'Dated reference · Feb 2026');
});

test('live-only filtering over references returns a clear public-source recovery action', () => {
    const records = mergeIntelSources({ publicReferenceItems: [linkedRecord({})] });
    const filtered = filterIntelForecasts({
        forecasts: records,
        selectedCategory: LIVE_INTEL_CATEGORY,
    });
    const emptyState = getFeedEmptyState({
        feedItems: filtered,
        selectedCategory: LIVE_INTEL_CATEGORY,
    });

    assert.deepEqual(filtered, []);
    assert.equal(emptyState.title, 'NO CURRENT PROVIDER UPDATES');
    assert.equal(emptyState.action, 'show-public-sources');
    assert.match(emptyState.message, /without a login/i);
});

test('searching supports source metadata and reports a clear no-match action', () => {
    const records = [linkedRecord({ Source: 'UN News' })];

    assert.equal(searchIntelForecasts(records, 'un news').length, 1);
    assert.equal(searchIntelForecasts(records, 'antarctica').length, 0);
    assert.equal(getFeedEmptyState({
        feedItems: [],
        feedSearch: 'antarctica',
    }).action, 'clear-search');
});

test('loading suppresses false failures and archived years ignore a saved live-only filter', () => {
    const historicalData = [linkedRecord({ isHistorical: true, Timeline: '2025' })];
    const filtered = filterIntelForecasts({
        forecasts: [],
        historicalData,
        selectedCategory: LIVE_INTEL_CATEGORY,
        timelineYear: '2025',
    });

    assert.equal(filtered.length, 1);
    assert.equal(getFeedEmptyState({
        feedItems: [],
        intelLoading: true,
    }), null);
    assert.notEqual(getFeedEmptyState({
        feedItems: [],
        selectedCategory: LIVE_INTEL_CATEGORY,
        historicalData: [],
    }).title, 'NO CURRENT PROVIDER UPDATES');
});
