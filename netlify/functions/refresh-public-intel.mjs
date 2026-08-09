import snapshotModule from './_shared/intel-snapshot.js';
import { writeSnapshot } from './_shared/snapshot-store.mjs';

const { buildPublicSnapshot } = snapshotModule;
const SNAPSHOT_KEY = 'public-intel/current.json';

export const handler = async event => {
    const snapshot = await buildPublicSnapshot();
    await writeSnapshot(SNAPSHOT_KEY, snapshot, event);
    console.log(`[refresh-public-intel] Stored ${snapshot.items.length} items with status ${snapshot.meta.status}.`);
    return { statusCode: 204 };
};

export const _test = { SNAPSHOT_KEY };
