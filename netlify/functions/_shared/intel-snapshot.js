const { normalizeProviderArticle } = require('./intel-normalization');

const SNAPSHOT_TTL_MS = 30 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 12000;
const FIXED_QUERIES = Object.freeze([
    {
        id: 'security-diplomacy',
        query: 'latest global diplomacy security conflict peace negotiations regional perspectives',
        results: 5,
    },
    {
        id: 'economy-development',
        query: 'latest global trade debt development labor food security Global South perspectives',
        results: 5,
    },
    {
        id: 'climate-resources',
        query: 'latest climate energy critical minerals water displacement regional policy perspectives',
        results: 5,
    },
    {
        id: 'rights-technology-health',
        query: 'latest human rights governance AI technology public health migration global perspectives',
        results: 5,
    },
]);

async function fetchWithTimeout(fetchImpl, url, options, timeoutMs = REQUEST_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetchImpl(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timeout);
    }
}

async function fetchQuery(fetchImpl, query, apiKey, results) {
    const response = await fetchWithTimeout(fetchImpl, 'https://google.serper.dev/news', {
        method: 'POST',
        headers: {
            'X-API-KEY': apiKey,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: query, num: results, gl: 'us', hl: 'en', tbs: 'qdr:m' }),
    });
    if (!response.ok) throw new Error(`Serper returned ${response.status}`);
    const data = await response.json();
    return Array.isArray(data.news) ? data.news : [];
}

function dedupeArticles(items) {
    const seenUrls = new Set();
    const seenTitles = new Set();
    return items.filter(item => {
        if (!item) return false;
        const urlKey = item.url.toLowerCase();
        const titleKey = item['Entity/Subject'].toLowerCase().replace(/\s+/g, ' ').trim();
        if (seenUrls.has(urlKey) || seenTitles.has(titleKey)) return false;
        seenUrls.add(urlKey);
        seenTitles.add(titleKey);
        return true;
    });
}

async function buildPublicSnapshot({
    apiKey = process.env.SERPER_API_KEY,
    fetchImpl = fetch,
    now = new Date(),
} = {}) {
    if (!apiKey) {
        return {
            items: [],
            minerals: {},
            meta: {
                generatedAt: now.toISOString(),
                sourceMode: 'public-cache',
                status: 'not-configured',
                provider: 'Serper',
                queryPolicy: 'fixed-editorial',
                cacheTtlSeconds: SNAPSHOT_TTL_MS / 1000,
                liveItemCount: 0,
            },
        };
    }

    const results = await Promise.allSettled(FIXED_QUERIES.map(query =>
        fetchQuery(fetchImpl, query.query, apiKey, query.results)
    ));
    const failures = results.filter(result => result.status === 'rejected').length;
    const items = dedupeArticles(results.flatMap(result =>
        result.status === 'fulfilled'
            ? result.value.map(item => normalizeProviderArticle(item, 'serper-public-cache'))
            : []
    )).slice(0, 20);

    return {
        items,
        minerals: {},
        meta: {
            generatedAt: now.toISOString(),
            sourceMode: 'public-cache',
            status: items.length > 0 ? (failures > 0 ? 'partial' : 'fresh') : 'unavailable',
            provider: 'Serper',
            queryPolicy: 'fixed-editorial',
            queryCount: FIXED_QUERIES.length,
            failedQueryCount: failures,
            cacheTtlSeconds: SNAPSHOT_TTL_MS / 1000,
            liveItemCount: items.length,
        },
    };
}

function withSnapshotAge(snapshot, now = Date.now()) {
    const generatedAt = new Date(snapshot?.meta?.generatedAt || 0).getTime();
    const ageSeconds = Number.isFinite(generatedAt) && generatedAt > 0
        ? Math.max(0, Math.floor((now - generatedAt) / 1000))
        : null;
    const stale = ageSeconds === null || ageSeconds > (SNAPSHOT_TTL_MS / 1000) * 2;
    return {
        ...snapshot,
        meta: {
            ...snapshot?.meta,
            ageSeconds,
            status: stale && snapshot?.items?.length ? 'stale' : snapshot?.meta?.status,
        },
    };
}

module.exports = {
    FIXED_QUERIES,
    REQUEST_TIMEOUT_MS,
    SNAPSHOT_TTL_MS,
    buildPublicSnapshot,
    dedupeArticles,
    withSnapshotAge,
};
