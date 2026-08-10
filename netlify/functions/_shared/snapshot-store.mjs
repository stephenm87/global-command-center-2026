import { getStore } from '@netlify/blobs';

export const STORE_NAME = 'global-command-center-snapshots';
let store;

function snapshotStore() {
    if (!store) store = getStore(STORE_NAME);
    return store;
}

export async function readSnapshot(key) {
    return snapshotStore().get(key, { type: 'json', consistency: 'strong' });
}

export async function writeSnapshot(key, value) {
    await snapshotStore().setJSON(key, value);
    return value;
}
