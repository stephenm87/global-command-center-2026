const manifest = require('./source-health-targets.json');
const { checkTargets, summarizeHealth } = require('./_shared/source-health');
const { writeSnapshot } = require('./_shared/snapshot-store');

const SNAPSHOT_KEY = 'source-health/current.json';

exports.handler = async () => {
    const checkedAt = new Date().toISOString();
    const results = await checkTargets(manifest.targets);
    const snapshot = {
        schemaVersion: 1,
        checkedAt,
        targetCount: results.length,
        summary: summarizeHealth(results),
        results,
    };
    await writeSnapshot(SNAPSHOT_KEY, snapshot);
    console.log(`[refresh-source-health] Checked ${results.length} links: ${JSON.stringify(snapshot.summary)}.`);
    return { statusCode: 204 };
};

exports._test = { SNAPSHOT_KEY };
