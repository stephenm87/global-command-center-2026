import { getDeployStore, getStore } from '@netlify/blobs';

export const STORE_NAME = 'global-command-center-snapshots';

export function resolveDeployContext({ context = null, env = process.env } = {}) {
    if (context?.deploy?.published === false) {
        return 'deploy-preview';
    }
    if (typeof context?.deploy?.context === 'string' && context.deploy.context.trim()) {
        return context.deploy.context.trim().toLowerCase();
    }
    if (typeof context?.deploy?.published === 'boolean') {
        return context.deploy.published ? 'production' : 'deploy-preview';
    }
    const netlifyContext = typeof globalThis.Netlify?.env?.get === 'function'
        ? globalThis.Netlify.env.get('CONTEXT')
        : '';
    const rawContext = typeof netlifyContext === 'string' && netlifyContext.trim()
        ? netlifyContext
        : env?.CONTEXT;
    if (typeof rawContext === 'string' && rawContext.trim()) {
        return rawContext.trim().toLowerCase();
    }
    return 'non-production';
}

export function isProductionContext(options = {}) {
    return resolveDeployContext(options) === 'production';
}

export function resolveSnapshotStore({
    context = null,
    env = process.env,
    getStoreFn = getStore,
    getDeployStoreFn = getDeployStore,
} = {}) {
    return isProductionContext({ context, env })
        ? getStoreFn(STORE_NAME)
        : getDeployStoreFn(STORE_NAME);
}

export async function readSnapshot(key, options = {}) {
    return resolveSnapshotStore(options).get(key, { type: 'json', consistency: 'strong' });
}

export async function writeSnapshot(key, value, options = {}) {
    await resolveSnapshotStore(options).setJSON(key, value);
    return value;
}
