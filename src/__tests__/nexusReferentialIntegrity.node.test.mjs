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

test('GPC_NODE_MAP, GPC_CONTEXT, and PRIMARY_ANCHORS match canonical NEXUS_ACTORS and pure Nexus helpers handle edge cases', async t => {
    const vite = await createTestViteServer(t);
    const [{ NEXUS_ACTORS }, nexusData] = await Promise.all([
        vite.ssrLoadModule('/src/nexusFocusData.js'),
        vite.ssrLoadModule('/src/nexus/nexusData.js'),
    ]);

    const canonicalIds = new Set(Object.keys(NEXUS_ACTORS));
    assert.deepEqual(
        Object.keys(nexusData.PRIMARY_ANCHORS).sort(),
        [...canonicalIds].sort(),
        'PRIMARY_ANCHORS must cover the exact canonical NEXUS_ACTORS IDs'
    );

    for (const [challenge, actorIds] of Object.entries(nexusData.GPC_NODE_MAP)) {
        for (const actorId of actorIds) {
            assert.ok(canonicalIds.has(actorId), `GPC_NODE_MAP.${challenge} references unknown actor ID "${actorId}"`);
        }
    }

    for (const [challenge, entries] of Object.entries(nexusData.GPC_CONTEXT)) {
        for (const [actorId, ctx] of Object.entries(entries)) {
            assert.ok(canonicalIds.has(actorId), `GPC_CONTEXT.${challenge} references unknown actor ID "${actorId}"`);
            for (const connId of ctx.connections || []) {
                assert.ok(
                    canonicalIds.has(connId),
                    `GPC_CONTEXT.${challenge}.${actorId}.connections references unknown actor ID "${connId}"`
                );
            }
        }
    }

    // Zero-distance camera math at origin (0, 0, 0) must not produce NaN/Infinity
    const originCam = nexusData.computeCameraFocusPosition({ x: 0, y: 0, z: 0 }, 220);
    assert.equal(Number.isFinite(originCam.x), true);
    assert.equal(Number.isFinite(originCam.y), true);
    assert.equal(Number.isFinite(originCam.z), true);
    assert.equal(originCam.z, 220);

    // ArrowUp / ArrowDown cycling must walk through all neighbors rather than sticking at index 0
    const neighbors = [{ id: 'China' }, { id: 'Europe' }, { id: 'Russia' }];
    const step1 = nexusData.stepNeighborIndex(neighbors, 'USA', -1, 1);
    const step2 = nexusData.stepNeighborIndex(neighbors, 'China', step1, 1);
    const step3 = nexusData.stepNeighborIndex(neighbors, 'Europe', step2, 1);
    const stepBack = nexusData.stepNeighborIndex(neighbors, 'Russia', step3, -1);
    assert.deepEqual([step1, step2, step3, stepBack], [0, 1, 2, 1]);

    // Pure 1D axis force pushes anchors toward target coordinates without external d3-force-3d import
    const forceNodes = [
        { id: 'USA', isAnchor: true, x: 0, vx: 0 },
        { id: 'Europe', isAnchor: true, x: 0, vx: 0 },
        { id: 'forecast-1', isAnchor: false, x: 0, vx: 0 },
    ];
    const axisForce = nexusData.createAxisForce(
        'x',
        d => (d.id === 'USA' ? -200 : 200),
        d => (d.isAnchor ? 0.18 : 0)
    );
    axisForce.initialize(forceNodes);
    axisForce(1);
    assert.ok(forceNodes[0].vx < 0, 'USA should accelerate toward negative x');
    assert.ok(forceNodes[1].vx > 0, 'Europe should accelerate toward positive x');
    assert.equal(forceNodes[2].vx, 0, 'Non-anchor satellites should remain unaffected');

    // Ensure dead nexusNarrative import and broken contextMenu / window._lastClickShift are removed from GlobalRelationsNexus.jsx
    const nexusSource = fs.readFileSync(path.join(REPO_ROOT, 'src/GlobalRelationsNexus.jsx'), 'utf8');
    assert.ok(!nexusSource.includes('nexusNarrative'), 'GlobalRelationsNexus.jsx should not import unused nexusNarrative');
    assert.ok(!nexusSource.includes('_lastClickShift'), 'GlobalRelationsNexus.jsx should not mutate window._lastClickShift');
    assert.ok(!nexusSource.includes('handleNodeRightClick'), 'GlobalRelationsNexus.jsx should not swallow right-click with an unrendered menu');
});
