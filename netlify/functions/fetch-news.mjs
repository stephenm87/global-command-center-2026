// fetch-news.mjs — Global Command Center
// Fetches latest geopolitical news via Serper, extracts entities+locations via Cloud NL API,
// returns globe-ready node objects for display as LIVE INTEL nodes
import securityModule from './security.js';
import { RATE_LIMIT_BLOB_FACTORIES } from './_shared/rate-limit-store.mjs';

const { protectEndpoint, readEnv, toResponse } = securityModule;

const MAX_BODY_BYTES = 4 * 1024;
const MAX_QUERY_LENGTH = 200;
const FIXED_RESULT_COUNT = 10;
const DEFAULT_DAILY_CAP = 300;

// ── Input sanitization ─────────────────────────────────────────────────────
function sanitizeQuery(raw) {
    if (!raw || typeof raw !== 'string') return null;
    // Max 200 chars, strip control chars and angle brackets
    return raw.substring(0, MAX_QUERY_LENGTH).replace(/[<>{}|\\^`]/g, '').trim();
}

const GEOPOLITICS_QUERY = 'geopolitical crisis conflict war sanctions sovereignty 2025 2026';

const CATEGORY_MAP = {
    'military': 'Geopolitics & Conflict',
    'war': 'Geopolitics & Conflict',
    'conflict': 'Geopolitics & Conflict',
    'troops': 'Geopolitics & Conflict',
    'nuclear': 'Geopolitics & Conflict',
    'missile': 'Geopolitics & Conflict',
    'strike': 'Geopolitics & Conflict',
    'sanction': 'Economy & Trade',
    'trade': 'Economy & Trade',
    'tariff': 'Economy & Trade',
    'inflation': 'Economy & Trade',
    'gdp': 'Economy & Trade',
    'gold': 'Economy & Trade',
    'mineral': 'Economy & Trade',
    'rare earth': 'Economy & Trade',
    'lithium': 'Economy & Trade',
    'copper': 'Economy & Trade',
    'cobalt': 'Economy & Trade',
    'resource': 'Economy & Trade',
    'supply chain': 'Economy & Trade',
    'climate': 'Environment & Energy',
    'energy': 'Environment & Energy',
    'oil': 'Environment & Energy',
    'gas': 'Environment & Energy',
    'emission': 'Environment & Energy',
    'pandemic': 'Health & Society',
    'health': 'Health & Society',
    'refugee': 'Health & Society',
    'human rights': 'Governance & Rights',
    'election': 'Governance & Rights',
    'constitution': 'Governance & Rights',
    'parliament': 'Governance & Rights',
    'judiciary': 'Governance & Rights',
    'indigenous': 'Governance & Rights',
    'democracy': 'Governance & Rights',
    'referendum': 'Governance & Rights',
    'tech': 'Technology & Science',
    'ai': 'Technology & Science',
    'cyber': 'Technology & Science',
    'semiconductor': 'Technology & Science',
    'chip': 'Technology & Science',
};

function inferCategory(title, snippet) {
    const text = `${title} ${snippet}`.toLowerCase();
    for (const [keyword, cat] of Object.entries(CATEGORY_MAP)) {
        if (text.includes(keyword)) return cat;
    }
    return 'Geopolitics & Conflict';
}

// Rough country → lat/lng map for common geopolitical actors
const COUNTRY_COORDS = {
    'united states': [38.9, -77.0], 'usa': [38.9, -77.0], 'america': [38.9, -77.0],
    'russia': [55.7, 37.6], 'ukraine': [50.4, 30.5], 'china': [39.9, 116.4],
    'israel': [31.8, 35.2], 'iran': [35.7, 51.4], 'north korea': [39.0, 125.7],
    'taiwan': [25.0, 121.5], 'india': [28.6, 77.2], 'pakistan': [33.7, 73.1],
    'saudi arabia': [24.7, 46.7], 'turkey': [39.9, 32.9], 'europe': [50.0, 10.0],
    'germany': [52.5, 13.4], 'france': [48.9, 2.3], 'uk': [51.5, -0.1],
    'united kingdom': [51.5, -0.1], 'brazil': [-15.8, -47.9], 'africa': [0, 25],
    'south africa': [-25.7, 28.2], 'nigeria': [9.1, 7.4], 'ethiopia': [9.0, 38.7],
    'egypt': [30.0, 31.2], 'syria': [33.5, 36.3], 'iraq': [33.3, 44.4],
    'afghanistan': [34.5, 69.2], 'japan': [35.7, 139.7], 'south korea': [37.6, 127.0],
    'philippines': [14.6, 121.0], 'vietnam': [21.0, 105.8], 'myanmar': [19.7, 96.1],
    'venezuela': [10.5, -66.9], 'mexico': [19.4, -99.1], 'colombia': [4.7, -74.1],
    'sudan': [15.6, 32.5], 'somalia': [2.0, 45.3],
    'gaza': [31.5, 34.5], 'west bank': [31.9, 35.3], 'lebanon': [33.9, 35.5],
    'yemen': [15.4, 44.2], 'libya': [32.9, 13.2], 'mali': [12.7, -8.0],
};

// Fast text-based coordinate inference — no API call needed
// This is the PRIMARY coord resolver so every article gets a chance
function inferCoordsFromText(text) {
    const lower = text.toLowerCase();
    // Sort by key length descending so "saudi arabia" matches before "arabia"
    const sorted = Object.entries(COUNTRY_COORDS).sort((a, b) => b[0].length - a[0].length);
    for (const [country, coords] of sorted) {
        if (lower.includes(country)) {
            return {
                lat: coords[0] + (Math.random() - 0.5) * 2.5,
                lng: coords[1] + (Math.random() - 0.5) * 2.5,
            };
        }
    }
    return null;
}

// NL API coord extraction — only used as an enhancement when a GCP project key is available
function extractCoordsFromEntities(entities) {
    if (!entities || !Array.isArray(entities)) return null;
    const locations = entities
        .filter(e => e.type === 'LOCATION' && e.salience > 0.05)
        .sort((a, b) => b.salience - a.salience);

    for (const loc of locations) {
        const name = loc.name.toLowerCase();
        for (const [country, coords] of Object.entries(COUNTRY_COORDS)) {
            if (name.includes(country) || country.includes(name)) {
                return { lat: coords[0], lng: coords[1] };
            }
        }
        if (loc.metadata?.latitude && loc.metadata?.longitude) {
            return { lat: parseFloat(loc.metadata.latitude), lng: parseFloat(loc.metadata.longitude) };
        }
    }
    return null;
}

async function analyzeArticle(text, apiKey, fetchImpl = fetch) {
    try {
        const res = await fetchImpl(
            'https://language.googleapis.com/v1/documents:analyzeEntities',
            {
                method: 'POST',
                signal: AbortSignal.timeout(10000),
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': apiKey,
                },
                body: JSON.stringify({ document: { type: 'PLAIN_TEXT', content: text }, encodingType: 'UTF8' }),
            },
        );
        if (!res.ok) return null;
        const data = await res.json();
        return data.entities || null;
    } catch {
        return null;
    }
}

function jsonResponse(status, headers, payload) {
    return new Response(JSON.stringify(payload), { status, headers });
}

export async function handleFetchNews(request, context = null, deps = {}) {
    const env = deps.env || process.env;
    const security = await protectEndpoint(request, {
        maxRequests: 30,
        scope: 'fetch-news',
        context,
        dailyCapEnv: 'FETCH_NEWS_DAILY_CAP',
        defaultDailyCap: DEFAULT_DAILY_CAP,
        maxBodyBytes: MAX_BODY_BYTES,
        env,
        ...RATE_LIMIT_BLOB_FACTORIES,
        ...(deps.securityOptions || {}),
    });
    if (security.response) return toResponse(security.response);

    const headers = security.headers;
    const fetchImpl = deps.fetchImpl || fetch;
    const serperKey = readEnv('SERPER_API_KEY', env);
    const googleNlKey = readEnv('GOOGLE_NL_API_KEY', env);

    if (!serperKey) {
        return jsonResponse(503, headers, { error: 'News search service is not configured.' });
    }

    try {
        let rawQuery = null;
        if (request.method === 'POST') {
            let payload;
            try {
                payload = JSON.parse(security.rawBody || '{}');
            } catch {
                return jsonResponse(400, headers, { error: 'Invalid JSON request body.' });
            }
            if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
                return jsonResponse(400, headers, { error: 'Request body must be a JSON object.' });
            }
            rawQuery = payload.query || null;
        }
        const customQuery = sanitizeQuery(rawQuery) || GEOPOLITICS_QUERY;

        const serperRes = await fetchImpl('https://google.serper.dev/news', {
            method: 'POST',
            signal: AbortSignal.timeout(12000),
            headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ q: customQuery, num: FIXED_RESULT_COUNT, tbs: 'qdr:d' }), // last 24h
        });

        if (!serperRes.ok) {
            throw new Error(`Serper upstream error (${serperRes.status})`);
        }

        const serperData = await serperRes.json();
        const articles = Array.isArray(serperData.news) ? serperData.news : [];

        if (articles.length === 0) {
            return jsonResponse(200, headers, { nodes: [], count: 0 });
        }

        // 2. For each article: text-based coord inference (always works) + optional NL API enhancement
        const nodes = [];

        await Promise.all(articles.slice(0, FIXED_RESULT_COUNT).map(async (article) => {
            const text = `${article.title}. ${article.snippet || ''}`;

            // PRIMARY: fast text-based lookup — no external API needed
            let coords = inferCoordsFromText(text);

            // ENHANCEMENT: try NL API for better entity extraction (only if GCP key available)
            let entities = null;
            if (googleNlKey && coords) { // only call NL API if text already found a region
                entities = await analyzeArticle(text, googleNlKey, fetchImpl);
                const nlCoords = extractCoordsFromEntities(entities);
                if (nlCoords) coords = nlCoords; // prefer NL precision when available
            }

            if (!coords) return; // No location found at all — skip

            const keyOrgs = entities
                ? entities.filter(e => ['PERSON', 'ORGANIZATION'].includes(e.type)).slice(0, 3).map(e => e.name).join(', ')
                : '';

            const category = inferCategory(article.title, article.snippet || '');

            nodes.push({
                'Topic/Sector': article.title?.substring(0, 80) || 'News Alert',
                'Entity/Subject': article.title || 'Breaking News',
                'Broad_Category': category,
                'Expected Impact/Value': article.snippet || '',
                'Key Player/Organization': keyOrgs || article.source || 'News Source',
                'Timeline': 'Live – ' + (article.date || 'Today'),
                Latitude: coords.lat,
                Longitude: coords.lng,
                url: article.link,
                isLive: true,
                isNews: true,
                source: article.source || 'News',
            });
        }));

        return jsonResponse(200, headers, { nodes, count: nodes.length });
    } catch (err) {
        const safeLabel = /^Serper upstream error/.test(err?.message || '')
            ? err.message
            : (err?.name || 'Error');
        console.error('[fetch-news] Error:', safeLabel);
        return jsonResponse(500, headers, { error: 'News scan failed. Please try again later.' });
    }
}

export default async (request, context) => handleFetchNews(request, context);

export const _test = {
    MAX_BODY_BYTES,
    MAX_QUERY_LENGTH,
    FIXED_RESULT_COUNT,
    DEFAULT_DAILY_CAP,
    GEOPOLITICS_QUERY,
    sanitizeQuery,
    inferCategory,
    inferCoordsFromText,
    extractCoordsFromEntities,
};
