const STORE_NAME = 'global-command-center-snapshots';
let storePromise;
let blobsModulePromise;

async function snapshotStore(event) {
    if (!blobsModulePromise) blobsModulePromise = import('@netlify/blobs');
    const blobs = await blobsModulePromise;
    if (event?.blobs) blobs.connectLambda(event);
    if (!storePromise) {
        storePromise = Promise.resolve(blobs.getStore(STORE_NAME));
    }
    return storePromise;
}

async function readSnapshot(key, event) {
    const store = await snapshotStore(event);
    return store.get(key, { type: 'json', consistency: 'strong' });
}

async function writeSnapshot(key, value, event) {
    const store = await snapshotStore(event);
    await store.setJSON(key, value);
    return value;
}

module.exports = { STORE_NAME, readSnapshot, writeSnapshot };
