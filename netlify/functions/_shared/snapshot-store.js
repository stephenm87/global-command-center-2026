const { getStore } = require('@netlify/blobs');

const STORE_NAME = 'global-command-center-snapshots';

function snapshotStore() {
    return getStore(STORE_NAME);
}

async function readSnapshot(key) {
    return snapshotStore().get(key, { type: 'json', consistency: 'strong' });
}

async function writeSnapshot(key, value) {
    await snapshotStore().setJSON(key, value);
    return value;
}

module.exports = { STORE_NAME, readSnapshot, writeSnapshot };
