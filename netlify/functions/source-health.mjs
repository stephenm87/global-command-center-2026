import securityModule from './security.js';
import { readSnapshot } from './_shared/snapshot-store.mjs';

const { protectPublicEndpoint } = securityModule;
const SNAPSHOT_KEY = 'source-health/current.json';
const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=60',
    'Netlify-CDN-Cache-Control': 'public, max-age=900, stale-while-revalidate=21600',
};

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
    try {
        const snapshot = await readSnapshot(SNAPSHOT_KEY);
        return new Response(
            JSON.stringify(snapshot || { status: 'pending', results: [], summary: null }),
            { status: 200, headers },
        );
    } catch (error) {
        console.error('[source-health] Snapshot unavailable:', error.message);
        return new Response(
            JSON.stringify({ status: 'unavailable', results: [], summary: null }),
            { status: 200, headers: { ...headers, 'Netlify-CDN-Cache-Control': 'public, max-age=60' } },
        );
    }
};

export const _test = { SNAPSHOT_KEY };
