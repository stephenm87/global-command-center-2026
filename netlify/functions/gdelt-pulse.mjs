import securityModule from './security.js';

const { protectPublicEndpoint } = securityModule;
const GDELT_DOC_API = 'https://api.gdeltproject.org/api/v2/doc/doc';

const ALLOWLISTED_PULSE_QUERIES = [
    'China United States trade',
    'Russia NATO military',
    'Sudan conflict RSF',
    'semiconductor TSMC chip',
    'Iran Israel Hezbollah',
    'fentanyl cartel Mexico',
    'cyberattack ransomware',
    'Wagner Africa',
];

const cacheHeaders = {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=120',
    'Netlify-CDN-Cache-Control': 'public, max-age=300, stale-while-revalidate=1800',
    'Netlify-Vary': 'header=Origin',
};

const errorCacheHeaders = {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=15',
    'Netlify-CDN-Cache-Control': 'public, max-age=30',
    'Netlify-Vary': 'header=Origin',
};

function sanitizeHttpUrl(rawUrl) {
    if (typeof rawUrl !== 'string' || !rawUrl.trim()) return null;
    try {
        const parsed = new URL(rawUrl.trim());
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
        return parsed.href;
    } catch {
        return null;
    }
}

function toLegacyEvent(request) {
    return { httpMethod: request.method, headers: Object.fromEntries(request.headers.entries()) };
}

function toResponse(response) {
    return new Response(response.body || null, { status: response.statusCode, headers: response.headers });
}

export function createGdeltPulseHandler({ fetchImpl = fetch } = {}) {
    return async request => {
        const event = toLegacyEvent(request);
        // Same-origin GET requests from browsers omit Origin; fixed allowlisted topic queries prevent caller query injection.
        const security = protectPublicEndpoint(event, { methods: ['GET'] });
        if (security.response) return toResponse(security.response);
        const responseHeaders = { ...security.headers, ...cacheHeaders };
        const errorHeaders = { ...security.headers, ...errorCacheHeaders };

        try {
            const urlObj = new URL(request.url);
            const rawTopic = Number.parseInt(urlObj.searchParams.get('topic') || '0', 10);
            const safeIndex = Number.isFinite(rawTopic)
                ? Math.abs(rawTopic) % ALLOWLISTED_PULSE_QUERIES.length
                : 0;
            const query = ALLOWLISTED_PULSE_QUERIES[safeIndex];
            const upstreamUrl = `${GDELT_DOC_API}?query=${encodeURIComponent(query)}&mode=ArtList&maxrecords=30&format=json&sort=DateDesc`;

            const res = await fetchImpl(upstreamUrl, { signal: AbortSignal.timeout(5000) });
            if (!res.ok) {
                return new Response(JSON.stringify({ articles: [], status: 'upstream-error' }), {
                    status: 200,
                    headers: errorHeaders,
                });
            }
            const data = await res.json();
            const articles = Array.isArray(data?.articles)
                ? data.articles
                    .slice(0, 30)
                    .map(article => {
                        const safeUrl = sanitizeHttpUrl(article?.url);
                        if (!safeUrl) return null;
                        return {
                            title: String(article?.title || ''),
                            url: safeUrl,
                            domain: String(article?.domain || ''),
                            seendate: String(article?.seendate || ''),
                            language: String(article?.language || 'en'),
                            tone: Number.parseFloat(article?.tone) || 0,
                        };
                    })
                    .filter(Boolean)
                : [];

            return new Response(JSON.stringify({ articles, topicIndex: safeIndex }), {
                status: 200,
                headers: responseHeaders,
            });
        } catch {
            return new Response(JSON.stringify({ articles: [], status: 'unavailable' }), {
                status: 200,
                headers: errorHeaders,
            });
        }
    };
}

export default createGdeltPulseHandler();
export const _test = { ALLOWLISTED_PULSE_QUERIES, sanitizeHttpUrl };
