import securityModule from './security.js';
import snapshotModule from './_shared/intel-snapshot.js';
import { readSnapshot, writeSnapshot } from './_shared/snapshot-store.mjs';

const { protectPublicEndpoint } = securityModule;
const {
    DEFAULT_PUBLIC_PROVIDER,
    SNAPSHOT_SCHEMA_VERSION,
    buildMineralBaseline,
    buildPublicSnapshot,
    withSnapshotAge,
} = snapshotModule;
const SNAPSHOT_KEY = 'public-intel/current.json';
let inFlightRefresh = null;

const publicHeaders = {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=60',
    'Netlify-CDN-Cache-Control': 'public, max-age=900, stale-while-revalidate=21600',
    'Netlify-Vary': 'header=Origin',
};

async function refreshSnapshot(context = null) {
    if (!inFlightRefresh) {
        inFlightRefresh = buildPublicSnapshot()
            .then(snapshot => writeSnapshot(SNAPSHOT_KEY, snapshot, { context }))
            .finally(() => { inFlightRefresh = null; });
    }
    return inFlightRefresh;
}

function toLegacyEvent(request) {
    return { httpMethod: request.method, headers: Object.fromEntries(request.headers.entries()) };
}

function toResponse(response) {
    return new Response(response.body || null, { status: response.statusCode, headers: response.headers });
}

export default async (request, context) => {
    const event = toLegacyEvent(request);
    const security = protectPublicEndpoint(event, { methods: ['GET'] });
    if (security.response) return toResponse(security.response);
    const responseHeaders = { ...security.headers, ...publicHeaders };

    try {
        const cached = await readSnapshot(SNAPSHOT_KEY, { context });
        const legacyErrorSnapshot = ['not-configured', 'provider-error', 'unavailable'].includes(cached?.meta?.status)
            && (!Array.isArray(cached?.items) || cached.items.length === 0)
            && cached?.meta?.provider === 'Serper';
        const needsSchemaUpgrade = !Array.isArray(cached?.meta?.providerResults)
            || cached?.meta?.snapshotSchemaVersion !== SNAPSHOT_SCHEMA_VERSION
            || (Array.isArray(cached?.items) && cached.items.some(item => !item?.coverage?.fundingLabel));
        if (cached?.meta && !legacyErrorSnapshot && !needsSchemaUpgrade) {
            return new Response(JSON.stringify(withSnapshotAge(cached)), { status: 200, headers: responseHeaders });
        }

        const snapshot = await refreshSnapshot(context);
        return new Response(JSON.stringify(withSnapshotAge(snapshot)), { status: 200, headers: responseHeaders });
    } catch (error) {
        console.error('[public-intel] Snapshot unavailable:', error.message);
        return new Response(JSON.stringify({
                items: [],
                minerals: buildMineralBaseline(),
                meta: {
                    generatedAt: new Date().toISOString(),
                    sourceMode: 'public-cache',
                    status: 'store-error',
                    errorCode: 'snapshot-store-error',
                    provider: DEFAULT_PUBLIC_PROVIDER,
                    queryPolicy: 'fixed-editorial',
                    liveItemCount: 0,
                },
            }), {
            status: 200,
            headers: { ...responseHeaders, 'Netlify-CDN-Cache-Control': 'public, max-age=60' },
        });
    }
};

export const _test = { SNAPSHOT_KEY, publicHeaders };
