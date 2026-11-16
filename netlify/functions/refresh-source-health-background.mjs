import { createRequire } from 'node:module';
import sourceHealthModule from './_shared/source-health.js';
import { readSnapshot, writeSnapshot } from './_shared/snapshot-store.mjs';

const require = createRequire(import.meta.url);
const manifest = require('./source-health-targets.json');
const { protectBackgroundCron } = require('./security.js');
const { checkTargets, summarizeHealth } = sourceHealthModule;

const SNAPSHOT_KEY = 'source-health/current.json';
const BACKGROUND_TIMEOUT_MS = 8000;
const BACKGROUND_CONCURRENCY = 4;
const BACKGROUND_MAX_PER_HOST = 2;
const BACKGROUND_DEADLINE_MS = 12 * 60 * 1000;

export async function runFullSourceHealthRefresh({
    targets = manifest.targets,
    fetchImpl = fetch,
    timeoutMs = BACKGROUND_TIMEOUT_MS,
    concurrency = BACKGROUND_CONCURRENCY,
    maxPerHost = BACKGROUND_MAX_PER_HOST,
    deadlineMs = BACKGROUND_DEADLINE_MS,
    readPrev = () => readSnapshot(SNAPSHOT_KEY).catch(() => null),
    writeNext = snapshot => writeSnapshot(SNAPSHOT_KEY, snapshot),
} = {}) {
    const checkedAt = new Date().toISOString();
    const previous = await readPrev();
    const previousByUrl = new Map(
        Array.isArray(previous?.results)
            ? previous.results.filter(r => r?.url && r.status !== 'unknown').map(r => [r.url, r])
            : []
    );

    const activeTargets = targets.filter(target => target.lifecycle !== 'archived');
    const rawResults = await checkTargets(activeTargets, {
        fetchImpl,
        timeoutMs,
        concurrency,
        maxPerHost,
        deadlineMs,
    });
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
        workerMode: 'background-15m',
        targetCount: results.length,
        incompleteCount,
        summary: summarizeHealth(results),
        results,
    };
    await writeNext(snapshot);
    return snapshot;
}

export default async request => {
    const guard = protectBackgroundCron(request);
    if (!guard.ok) {
        return new Response(JSON.stringify({ error: guard.message }), {
            status: guard.status,
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Cache-Control': 'private, no-store',
            },
        });
    }

    const snapshot = await runFullSourceHealthRefresh();
    console.log(`[refresh-source-health-background] Checked ${snapshot.targetCount} active links (${snapshot.incompleteCount} deferred): ${JSON.stringify(snapshot.summary)}.`);
    return new Response(null, { status: 202 });
};

export const _test = {
    SNAPSHOT_KEY,
    BACKGROUND_TIMEOUT_MS,
    BACKGROUND_CONCURRENCY,
};
