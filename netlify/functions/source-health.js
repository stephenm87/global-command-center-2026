const { protectPublicEndpoint } = require('./security');
const { readSnapshot } = require('./_shared/snapshot-store');

const SNAPSHOT_KEY = 'source-health/current.json';
const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=60',
    'Netlify-CDN-Cache-Control': 'public, max-age=900, stale-while-revalidate=21600',
};

exports.handler = async event => {
    const security = protectPublicEndpoint(event, { methods: ['GET'] });
    if (security.response) return security.response;
    try {
        const snapshot = await readSnapshot(SNAPSHOT_KEY, event);
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(snapshot || { status: 'pending', results: [], summary: null }),
        };
    } catch (error) {
        console.error('[source-health] Snapshot unavailable:', error.message);
        return {
            statusCode: 200,
            headers: { ...headers, 'Netlify-CDN-Cache-Control': 'public, max-age=60' },
            body: JSON.stringify({ status: 'unavailable', results: [], summary: null }),
        };
    }
};

exports._test = { SNAPSHOT_KEY };
