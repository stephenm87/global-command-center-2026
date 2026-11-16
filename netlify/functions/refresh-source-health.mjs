import { createRequire } from 'node:module';
import sourceHealthModule from './_shared/source-health.js';
import { readSnapshot, writeSnapshot } from './_shared/snapshot-store.mjs';

const require = createRequire(import.meta.url);
const manifest = require('./source-health-targets.json');
const { DEFAULT_DEADLINE_MS, checkTargets, summarizeHealth } = sourceHealthModule;
const SNAPSHOT_KEY = 'source-health/current.json';

export default async () => {
    const checkedAt = new Date().toISOString();
    const previous = await readSnapshot(SNAPSHOT_KEY).catch(() => null);
    const previousByUrl = new Map(
        Array.isArray(previous?.results)
            ? previous.results.filter(r => r?.url && r.status !== 'unknown').map(r => [r.url, r])
            : []
    );

    const rawResults = await checkTargets(manifest.targets, { deadlineMs: DEFAULT_DEADLINE_MS });
    const results = rawResults.map(result => {
        if (result.reason === 'deadline-exceeded' && previousByUrl.has(result.url)) {
            const carried = previousByUrl.get(result.url);
            return { ...carried, id: result.id, url: result.url, carriedForward: true };
        }
        return result;
    });
    const incompleteCount = rawResults.filter(r => r.reason === 'deadline-exceeded').length;

    const snapshot = {
        schemaVersion: 1,
        checkedAt,
        targetCount: results.length,
        incompleteCount,
        summary: summarizeHealth(results),
        results,
    };
    await writeSnapshot(SNAPSHOT_KEY, snapshot);
    console.log(`[refresh-source-health] Checked ${results.length} links (${incompleteCount} deadline-deferred): ${JSON.stringify(snapshot.summary)}.`);
    return new Response(null, { status: 204 });
};

export const _test = { SNAPSHOT_KEY };
