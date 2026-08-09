import { createRequire } from 'node:module';
import sourceHealthModule from './_shared/source-health.js';
import { writeSnapshot } from './_shared/snapshot-store.mjs';

const require = createRequire(import.meta.url);
const manifest = require('./source-health-targets.json');
const { checkTargets, summarizeHealth } = sourceHealthModule;
const SNAPSHOT_KEY = 'source-health/current.json';

export const handler = async event => {
    const checkedAt = new Date().toISOString();
    const results = await checkTargets(manifest.targets);
    const snapshot = {
        schemaVersion: 1,
        checkedAt,
        targetCount: results.length,
        summary: summarizeHealth(results),
        results,
    };
    await writeSnapshot(SNAPSHOT_KEY, snapshot, event);
    console.log(`[refresh-source-health] Checked ${results.length} links: ${JSON.stringify(snapshot.summary)}.`);
    return { statusCode: 204 };
};

export const _test = { SNAPSHOT_KEY };
