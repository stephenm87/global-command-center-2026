import { connectLambda, getStore } from '@netlify/blobs';

export const STORE_NAME = 'global-command-center-snapshots';
let store;

function snapshotStore(event) {
    connectLambda(event);
    if (!store) store = getStore(STORE_NAME);
    return store;
}

export async function readSnapshot(key, event) {
    return snapshotStore(event).get(key, { type: 'json', consistency: 'strong' });
}

export async function writeSnapshot(key, value, event) {
    await snapshotStore(event).setJSON(key, value);
    return value;
}
