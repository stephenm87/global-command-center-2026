import securityModule from './security.js';
import { readSnapshot } from './_shared/snapshot-store.mjs';

const { protectPublicEndpoint } = securityModule;
const SNAPSHOT_KEY = 'source-health/current.json';
const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=60',
    'Netlify-CDN-Cache-Control': 'public, max-age=900, stale-while-revalidate=21600',
    'Netlify-Vary': 'header=Origin',
};

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
    const responseHeaders = { ...security.headers, ...headers };
    try {
        const snapshot = await readSnapshot(SNAPSHOT_KEY, { context });
        if (!snapshot) {
            return new Response(
                JSON.stringify({ status: 'pending', stale: true, results: [], summary: null }),
                { status: 200, headers: responseHeaders },
            );
        }
        const checkedMs = snapshot.checkedAt ? Date.parse(snapshot.checkedAt) : Number.NaN;
        const stale = !Number.isFinite(checkedMs) || (Date.now() - checkedMs) > 36 * 60 * 60 * 1000;
        return new Response(
            JSON.stringify({ ...snapshot, stale }),
            { status: 200, headers: responseHeaders },
        );
    } catch (error) {
        console.error('[source-health] Snapshot unavailable:', error.message);
        return new Response(
            JSON.stringify({ status: 'unavailable', results: [], summary: null }),
            { status: 200, headers: { ...responseHeaders, 'Netlify-CDN-Cache-Control': 'public, max-age=60' } },
        );
    }
};

export const _test = { SNAPSHOT_KEY };
