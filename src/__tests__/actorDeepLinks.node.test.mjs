import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('resolveActorId and legacy ?view=nexus links resolve cleanly into Guided Briefings', async t => {
    const vite = await createServer({
        configFile: false,
        root: REPO_ROOT,
        cacheDir: `/tmp/vite-gcc-deeplink-test-${process.pid}`,
        appType: 'custom',
        logLevel: 'silent',
        optimizeDeps: { noDiscovery: true },
        server: { middlewareMode: true },
    });
    t.after(() => vite.close());

    const { BRIEFING_ACTORS, CANONICAL_ACTOR_IDS, resolveActorId } = await vite.ssrLoadModule('/src/briefingActors.js');
    const { parseViewFromSearch, parseBriefingEntryFromSearch, VIEW_MODES } = await vite.ssrLoadModule('/src/navigationState.mjs');
    assert.deepEqual(
        [...CANONICAL_ACTOR_IDS].sort(),
        Object.keys(BRIEFING_ACTORS).sort(),
        'CANONICAL_ACTOR_IDS must stay in 1:1 sync with BRIEFING_ACTORS'
    );
    assert.equal(typeof resolveActorId, 'function', 'briefingActors.js must export resolveActorId');
    assert.equal(resolveActorId('europe'), 'Europe');
    assert.equal(resolveActorId('EUROPE'), 'Europe');
    assert.equal(resolveActorId('cyberactors'), 'CyberActors');
    assert.equal(resolveActorId('un_opec'), 'UN_OPEC');
    assert.equal(resolveActorId('unknown-actor', 'USA'), 'USA');
    assert.equal(resolveActorId('unknown-actor', null), null);

    assert.deepEqual(VIEW_MODES, ['globe', 'briefings']);
    assert.equal(parseViewFromSearch('?view=nexus'), 'briefings', 'Legacy ?view=nexus must resolve to briefings');
    assert.equal(parseViewFromSearch('?view=nexus&actor=China'), 'briefings', 'Legacy ?view=nexus&actor=... must resolve to briefings');
    assert.deepEqual(parseBriefingEntryFromSearch('?view=nexus&actor=china'), {
        tourId: undefined,
        nodeId: 'China',
        step: undefined,
    });

    for (const removedFile of [
        'src/NexusWorkspace.jsx',
        'src/NexusWorkspace.css',
        'src/NexusFocusView.jsx',
        'src/NexusFocusView.css',
        'src/nexusFocusData.js',
        'src/nexusEdgeData.js',
        'src/nexus/actorIds.js',
    ]) {
        assert.equal(fs.existsSync(path.join(REPO_ROOT, removedFile)), false, `${removedFile} must be removed`);
    }

    // Verify all 4 previously 404 URLs remain absent across modular src/cases/active/*.mjs
    const activeCasesDir = path.join(REPO_ROOT, 'src/cases/active');
    const combinedCaseSources = fs.readdirSync(activeCasesDir)
        .filter(f => f.endsWith('.mjs'))
        .map(f => fs.readFileSync(path.join(activeCasesDir, f), 'utf8'))
        .join('\n');

    assert.ok(!combinedCaseSources.includes('horntribune.com'), 'Broken horntribune.com 404 URLs must be replaced');
    assert.ok(!combinedCaseSources.includes('un.org/ldcportal/node/858'), 'Broken un.org/ldcportal/node/858 404 URL must be replaced');
    assert.ok(!combinedCaseSources.includes('mppre.gob.ve/publicacion/7224'), 'Broken mppre.gob.ve 404 URL must be replaced');
});
