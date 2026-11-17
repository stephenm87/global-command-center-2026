import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { filterIntelForecasts, ALL_INTEL_CATEGORY, LIVE_INTEL_CATEGORY } from '../intelFeed.mjs';
import { REPO_ROOT, readAppWorkspaceSource } from './_helpers/readAppSources.mjs';

const require = createRequire(import.meta.url);

test('filterIntelForecasts filters live, category, archive year, and news-only modes without any Globe instance', () => {
    const forecasts = [
        { 'Entity/Subject': 'Red Sea Shipping', Broad_Category: 'Geopolitics & Conflict', Timeline: '2026', isLive: true },
        { 'Entity/Subject': 'Chip Controls', Broad_Category: 'Economy & Trade', Timeline: '2026', isLive: false },
        { 'Entity/Subject': 'Custom Scan Hit', Broad_Category: 'Geopolitics & Conflict', Timeline: 'Live', isLive: true, isNews: true },
    ];
    const archive2024 = [
        { 'Entity/Subject': '2024 Election Wave', Broad_Category: 'Geopolitics & Conflict', Timeline: '2024', isHistorical: true },
    ];

    assert.equal(filterIntelForecasts({ forecasts, selectedCategory: ALL_INTEL_CATEGORY }).length, 3);
    assert.equal(filterIntelForecasts({ forecasts, selectedCategory: LIVE_INTEL_CATEGORY }).length, 2);
    assert.equal(filterIntelForecasts({ forecasts, selectedCategory: 'Economy & Trade' }).length, 1);
    assert.equal(filterIntelForecasts({ forecasts, globeNewsOnly: true }).length, 1);
    assert.equal(
        filterIntelForecasts({ forecasts, historicalData: archive2024, selectedCategory: LIVE_INTEL_CATEGORY, timelineYear: '2024' }).length,
        1,
        'Archived year should ignore stale LIVE_INTEL_CATEGORY filter without needing WebGL'
    );
});

test('public-intel snapshot and frontend share one cited criticalMinerals.json catalog across Au, Ag, Li, Co, Cu, REE', async () => {
    const snapshotModule = require('../../netlify/functions/_shared/intel-snapshot.js');
    const catalog = require('../data/criticalMinerals.json');
    const unconfigured = await snapshotModule.buildPublicSnapshot({ apiKey: '' });

    assert.ok(catalog.asOf && catalog.sourceLabel && /^https:\/\//.test(catalog.sourceUrl), 'criticalMinerals.json must carry dated HTTPS source citation');

    const expectedSymbols = {
        gold: 'Au',
        silver: 'Ag',
        lithium: 'Li',
        cobalt: 'Co',
        copper: 'Cu',
        rareEarths: 'REE',
    };

    for (const [key, symbol] of Object.entries(expectedSymbols)) {
        const entry = unconfigured.minerals?.[key];
        assert.ok(entry, `Missing mineral telemetry entry for ${key}`);
        assert.equal(entry.symbol, symbol, `Expected canonical symbol ${symbol} for ${key}`);
        assert.equal(entry.price, catalog.minerals[key].price, `Backend mineral baseline for ${key} must match shared criticalMinerals.json`);
        assert.equal(entry.sourceUrl, catalog.sourceUrl);
        assert.ok(typeof entry.origins === 'string' && entry.origins.length > 0, `Expected primary origins for ${key}`);
        assert.ok(typeof entry.players === 'string' && entry.players.length > 0, `Expected major players for ${key}`);
    }
});

test('App workspace decouples filteredForecasts from globeEl, pauses hidden Globe, surfaces Deep Scan sign-in CTA, and scopes theory-btn CSS', () => {
    const appSource = readAppWorkspaceSource();
    const appRootJsx = fs.readFileSync(path.join(REPO_ROOT, 'src/App.jsx'), 'utf8');
    const cssSource = fs.readFileSync(path.join(REPO_ROOT, 'src/App.css'), 'utf8');

    assert.match(appRootJsx, /\buseGlobeLayerSync\s*\(\s*\{/, 'App.jsx must invoke useGlobeLayerSync');

    // F-11: filteredForecasts derived via useMemo rather than useState gated behind globeEl.current
    assert.ok(!appSource.includes('setFilteredForecasts('), 'filteredForecasts must be derived via useMemo, not stored via setFilteredForecasts');
    assert.match(appSource, /const\s+filteredForecasts\s*=\s*useMemo\s*\(/, 'App.jsx must compute filteredForecasts with useMemo');
    assert.match(appSource, /pauseAnimation(?:\?\.)?\s*\(/, 'App.jsx must pause Globe WebGL animation when globe workspace is hidden');

    // F-05 UI: signed-out Deep Scan shows actionable Sign-In CTA
    assert.match(appSource, /requiresAuth/, 'handleDeepScan must flag unauthenticated requests with requiresAuth for Sign-In CTA');

    // F-25: dead client-side COORDS fallback inside fetchLiveNews removed
    assert.ok(!appSource.includes("const COORDS = {\n            'united states'"), 'Dead client-side COORDS table in fetchLiveNews must be removed');

    // F-03: Arc Legend uses .legend-theory-btn so .detail-modal .theory-btn.active retains high contrast
    assert.ok(appSource.includes('legend-theory-btn'), 'Arc Legend theory buttons should use legend-theory-btn class');
    assert.match(cssSource, /\.detail-modal\s+\.theory-btn\.active\s*\{[\s\S]*?color:\s*#fff(?:fff)?\b/i);
    assert.ok(!/\n\.theory-btn\.active\s*\{\s*background:\s*rgba\(255,\s*255,\s*255,\s*0\.08\)/.test(cssSource), 'Unscoped .theory-btn.active override must be renamed to .legend-theory-btn.active');
});
