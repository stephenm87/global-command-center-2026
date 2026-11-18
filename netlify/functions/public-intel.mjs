import securityModule from './security.js';
import snapshotModule from './_shared/intel-snapshot.js';
import { readSnapshot, writeSnapshot } from './_shared/snapshot-store.mjs';

const { protectPublicEndpoint } = securityModule;
const { buildMineralBaseline, buildPublicSnapshot, withSnapshotAge } = snapshotModule;
const SNAPSHOT_KEY = 'public-intel/current.json';
let inFlightRefresh = null;

const publicHeaders = {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=60',
    'Netlify-CDN-Cache-Control': 'public, max-age=900, stale-while-revalidate=21600',
    'Netlify-Vary': 'header=Origin',
};

async function refreshSnapshot() {
    if (!inFlightRefresh) {
        inFlightRefresh = buildPublicSnapshot()
            .then(snapshot => writeSnapshot(SNAPSHOT_KEY, snapshot))
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

export default async request => {
    const event = toLegacyEvent(request);
    const security = protectPublicEndpoint(event, { methods: ['GET'] });
    if (security.response) return toResponse(security.response);
    const responseHeaders = { ...security.headers, ...publicHeaders };

    try {
        const cached = await readSnapshot(SNAPSHOT_KEY);
        const configurationBecameAvailable = cached?.meta?.status === 'not-configured' && process.env.SERPER_API_KEY;
        const legacyUnavailableNeedsDiag = cached?.meta?.status === 'unavailable'
            && Number(cached?.meta?.failedQueryCount) > 0
            && !cached?.meta?.errorCode
            && process.env.SERPER_API_KEY;
        if (cached?.meta && !configurationBecameAvailable && !legacyUnavailableNeedsDiag) {
            return new Response(JSON.stringify(withSnapshotAge(cached)), { status: 200, headers: responseHeaders });
        }

        const snapshot = await refreshSnapshot();
        return new Response(JSON.stringify(withSnapshotAge(snapshot)), { status: 200, headers: responseHeaders });
    } catch (error) {
        console.error('[public-intel] Snapshot unavailable:', error.message);
        const hasKey = Boolean(process.env.SERPER_API_KEY);
        const status = hasKey ? 'store-error' : 'not-configured';
        return new Response(JSON.stringify({
                items: [],
                minerals: buildMineralBaseline(),
                meta: {
                    generatedAt: new Date().toISOString(),
                    sourceMode: 'public-cache',
                    status,
                    ...(hasKey ? { errorCode: 'snapshot-store-error' } : {}),
                    provider: 'Serper',
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
