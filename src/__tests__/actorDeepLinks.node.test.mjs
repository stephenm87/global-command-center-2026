import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('resolveActorId normalizes case-insensitive ?actor= deep links across Focus and 3D Nexus', async t => {
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

    const { NEXUS_ACTORS, resolveActorId } = await vite.ssrLoadModule('/src/nexusFocusData.js');
    const { CANONICAL_ACTOR_IDS } = await vite.ssrLoadModule('/src/nexus/actorIds.js');
    assert.deepEqual(
        [...CANONICAL_ACTOR_IDS].sort(),
        Object.keys(NEXUS_ACTORS).sort(),
        'CANONICAL_ACTOR_IDS in actorIds.js must stay in 1:1 sync with NEXUS_ACTORS'
    );
    assert.equal(typeof resolveActorId, 'function', 'nexusFocusData.js must export resolveActorId');
    assert.equal(resolveActorId('europe'), 'Europe');
    assert.equal(resolveActorId('EUROPE'), 'Europe');
    assert.equal(resolveActorId('cyberactors'), 'CyberActors');
    assert.equal(resolveActorId('un_opec'), 'UN_OPEC');
    assert.equal(resolveActorId('unknown-actor', 'USA'), 'USA');
    assert.equal(resolveActorId('unknown-actor', null), null);

    const appSource = fs.readFileSync(path.join(REPO_ROOT, 'src/App.jsx'), 'utf8');
    const focusSource = fs.readFileSync(path.join(REPO_ROOT, 'src/NexusFocusView.jsx'), 'utf8');
    const spatialSource = fs.readFileSync(path.join(REPO_ROOT, 'src/GlobalRelationsNexus.jsx'), 'utf8');

    assert.ok(appSource.includes('resolveActorId('), 'App.jsx must normalize ?actor= via resolveActorId');
    assert.ok(focusSource.includes('resolveActorId('), 'NexusFocusView.jsx must normalize initialNodeId via resolveActorId');
    assert.ok(spatialSource.includes('resolveActorId('), 'GlobalRelationsNexus.jsx must normalize initialNodeId via resolveActorId');

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
