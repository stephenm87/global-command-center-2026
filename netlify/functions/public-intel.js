const { protectPublicEndpoint } = require('./security');
const { buildPublicSnapshot, withSnapshotAge } = require('./_shared/intel-snapshot');
const { readSnapshot, writeSnapshot } = require('./_shared/snapshot-store');

const SNAPSHOT_KEY = 'public-intel/current.json';
let inFlightRefresh = null;

const publicHeaders = {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=60',
    'Netlify-CDN-Cache-Control': 'public, max-age=900, stale-while-revalidate=21600',
};

async function refreshSnapshot() {
    if (!inFlightRefresh) {
        inFlightRefresh = buildPublicSnapshot()
            .then(snapshot => writeSnapshot(SNAPSHOT_KEY, snapshot))
            .finally(() => { inFlightRefresh = null; });
    }
    return inFlightRefresh;
}

exports.handler = async event => {
    const security = protectPublicEndpoint(event, { methods: ['GET'] });
    if (security.response) return security.response;

    try {
        const cached = await readSnapshot(SNAPSHOT_KEY);
        const configurationBecameAvailable = cached?.meta?.status === 'not-configured' && process.env.SERPER_API_KEY;
        if (cached?.meta && !configurationBecameAvailable) {
            return { statusCode: 200, headers: publicHeaders, body: JSON.stringify(withSnapshotAge(cached)) };
        }

        const snapshot = await refreshSnapshot();
        return { statusCode: 200, headers: publicHeaders, body: JSON.stringify(withSnapshotAge(snapshot)) };
    } catch (error) {
        console.error('[public-intel] Snapshot unavailable:', error.message);
        const status = process.env.SERPER_API_KEY ? 'unavailable' : 'not-configured';
        return {
            statusCode: 200,
            headers: { ...publicHeaders, 'Netlify-CDN-Cache-Control': 'public, max-age=60' },
            body: JSON.stringify({
                items: [],
                minerals: {},
                meta: {
                    generatedAt: new Date().toISOString(),
                    sourceMode: 'public-cache',
                    status,
                    provider: 'Serper',
                    queryPolicy: 'fixed-editorial',
                    liveItemCount: 0,
                },
            }),
        };
    }
};

exports._test = { SNAPSHOT_KEY, publicHeaders };
