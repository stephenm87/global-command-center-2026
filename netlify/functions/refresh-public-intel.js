const { buildPublicSnapshot } = require('./_shared/intel-snapshot');
const { writeSnapshot } = require('./_shared/snapshot-store');

const SNAPSHOT_KEY = 'public-intel/current.json';

exports.handler = async () => {
    const snapshot = await buildPublicSnapshot();
    await writeSnapshot(SNAPSHOT_KEY, snapshot);
    console.log(`[refresh-public-intel] Stored ${snapshot.items.length} items with status ${snapshot.meta.status}.`);
    return { statusCode: 204 };
};

exports._test = { SNAPSHOT_KEY };
