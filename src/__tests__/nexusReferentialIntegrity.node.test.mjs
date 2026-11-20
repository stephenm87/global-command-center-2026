import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

async function createTestViteServer(t) {
    const vite = await createServer({
        configFile: false,
        root: REPO_ROOT,
        cacheDir: `/tmp/vite-gcc-nexus-test-${process.pid}`,
        appType: 'custom',
        logLevel: 'silent',
        esbuild: { jsx: 'automatic' },
        optimizeDeps: { noDiscovery: true },
        server: { middlewareMode: true },
    });
    t.after(() => vite.close());
    return vite;
}

test('every EDGE_DESCRIPTIONS timeline mentions BOTH of its edge actors via canonical ACTOR_KEYWORDS and has valid NEXUS_ACTORS endpoints', async t => {
    const vite = await createTestViteServer(t);
    const [{ NEXUS_ACTORS, ACTOR_KEYWORDS }, { EDGE_DESCRIPTIONS }] = await Promise.all([
        vite.ssrLoadModule('/src/nexusFocusData.js'),
        vite.ssrLoadModule('/src/nexusEdgeData.js'),
    ]);

    assert.ok(ACTOR_KEYWORDS, 'nexusFocusData.js should export ACTOR_KEYWORDS for referential integrity checks');

    const mismatches = [];
    for (const [edgeKey, detail] of Object.entries(EDGE_DESCRIPTIONS)) {
        const [source, target] = edgeKey.split('|');
        assert.ok(NEXUS_ACTORS[source], `Unknown source actor ${source} on edge ${edgeKey}`);
        assert.ok(NEXUS_ACTORS[target], `Unknown target actor ${target} on edge ${edgeKey}`);

        if (Array.isArray(detail.timeline) && detail.timeline.length > 0) {
            const timelineText = detail.timeline.map(entry => `${entry.year} ${entry.event}`).join(' ');
            const matchesSource = Boolean(ACTOR_KEYWORDS[source]?.test(timelineText));
            const matchesTarget = Boolean(ACTOR_KEYWORDS[target]?.test(timelineText));
            if (!matchesSource || !matchesTarget) {
                mismatches.push(`${edgeKey} (source=${matchesSource}, target=${matchesTarget})`);
            }
        }
    }

    assert.deepEqual(mismatches, [], `Slipped or single-sided edge timelines detected: ${mismatches.join(', ')}`);
});

test('NEXUS_ACTORS matches CANONICAL_ACTOR_IDS and 3D GlobalRelationsNexus files remain removed', async t => {
    const vite = await createTestViteServer(t);
    const [{ NEXUS_ACTORS }, { CANONICAL_ACTOR_IDS }] = await Promise.all([
        vite.ssrLoadModule('/src/nexusFocusData.js'),
        vite.ssrLoadModule('/src/nexus/actorIds.js'),
    ]);

    assert.deepEqual(
        [...CANONICAL_ACTOR_IDS].sort(),
        Object.keys(NEXUS_ACTORS).sort(),
        'NEXUS_ACTORS must stay in exact 1:1 sync with CANONICAL_ACTOR_IDS'
    );
    assert.equal(
        fs.existsSync(path.join(REPO_ROOT, 'src/GlobalRelationsNexus.jsx')),
        false,
        '3D GlobalRelationsNexus.jsx must stay removed'
    );
});
