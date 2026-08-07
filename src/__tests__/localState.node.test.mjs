import test from 'node:test';
import assert from 'node:assert/strict';

import { readStoredJson, writeStoredJson } from '../localState.mjs';

function memoryStorage(initial = {}) {
    const values = new Map(Object.entries(initial));
    return {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
        value: key => values.get(key),
    };
}

test('reads valid JSON state', () => {
    const storage = memoryStorage({ preferences: '{"mode":"nexus"}' });
    assert.deepEqual(readStoredJson('preferences', {}, storage), { mode: 'nexus' });
});

test('falls back when saved JSON is malformed or storage is blocked', () => {
    assert.deepEqual(readStoredJson('preferences', { safe: true }, memoryStorage({ preferences: '{bad' })), { safe: true });
    const blocked = { getItem: () => { throw new Error('blocked'); } };
    assert.deepEqual(readStoredJson('preferences', { safe: true }, blocked), { safe: true });
});

test('writes JSON and reports unavailable storage without throwing', () => {
    const storage = memoryStorage();
    assert.equal(writeStoredJson('preferences', { mode: 'map' }, storage), true);
    assert.equal(storage.value('preferences'), '{"mode":"map"}');
    assert.equal(writeStoredJson('preferences', {}, null), false);
});
