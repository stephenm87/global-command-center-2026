export function getBrowserStorage() {
    try {
        return globalThis.localStorage || null;
    } catch {
        return null;
    }
}

export function readStoredJson(key, fallback, storage = getBrowserStorage()) {
    try {
        const raw = storage?.getItem(key);
        if (!raw) return fallback;
        const value = JSON.parse(raw);
        return value ?? fallback;
    } catch {
        return fallback;
    }
}

export function writeStoredJson(key, value, storage = getBrowserStorage()) {
    try {
        if (!storage) return false;
        storage.setItem(key, JSON.stringify(value));
        return true;
    } catch {
        return false;
    }
}
