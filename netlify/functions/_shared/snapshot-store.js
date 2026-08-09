const STORE_NAME = 'global-command-center-snapshots';
let storePromise;

async function snapshotStore() {
    if (!storePromise) {
        storePromise = import('@netlify/blobs').then(({ getStore }) => getStore(STORE_NAME));
    }
    return storePromise;
}

async function readSnapshot(key) {
    const store = await snapshotStore();
    return store.get(key, { type: 'json', consistency: 'strong' });
}

async function writeSnapshot(key, value) {
    const store = await snapshotStore();
    await store.setJSON(key, value);
    return value;
}

module.exports = { STORE_NAME, readSnapshot, writeSnapshot };
