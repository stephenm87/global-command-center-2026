import snapshotModule from './_shared/intel-snapshot.js';
import { writeSnapshot } from './_shared/snapshot-store.mjs';

const { buildPublicSnapshot } = snapshotModule;
const SNAPSHOT_KEY = 'public-intel/current.json';

export default async () => {
    const snapshot = await buildPublicSnapshot();
    await writeSnapshot(SNAPSHOT_KEY, snapshot);
    console.log(`[refresh-public-intel] Stored ${snapshot.items.length} items with status ${snapshot.meta.status}.`);
    return new Response(null, { status: 204 });
};

export const _test = { SNAPSHOT_KEY };
