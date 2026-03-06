// fetch-news.js — Global Command Center
// Fetches latest geopolitical news via Serper, extracts entities+locations via Cloud NL API,
// returns globe-ready node objects for display as LIVE INTEL nodes

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
    'human rights': 'Health & Society',
    'refugee': 'Health & Society',
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
                lng: coords[1] + (Math.random() - 0.5) * 2.5
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
                return { lat: coords[0] + (Math.random() - 0.5) * 2, lng: coords[1] + (Math.random() - 0.5) * 2 };
            }
        }
        if (loc.metadata?.latitude && loc.metadata?.longitude) {
            return { lat: parseFloat(loc.metadata.latitude), lng: parseFloat(loc.metadata.longitude) };
        }
    }
    return null;
}

async function analyzeArticle(text, apiKey) {
    try {
        const res = await fetch(
            `https://language.googleapis.com/v1/documents:analyzeEntities?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ document: { type: 'PLAIN_TEXT', content: text }, encodingType: 'UTF8' })
            }
        );
        if (!res.ok) return null;
        const data = await res.json();
        return data.entities || null;
    } catch {
        return null;
    }
}

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const serperKey = process.env.SERPER_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (!serperKey) {
        return { statusCode: 500, body: JSON.stringify({ error: 'SERPER_API_KEY not configured' }) };
    }

    try {
        // 1. Fetch news via Serper
        const customQuery = event.httpMethod === 'POST'
            ? (JSON.parse(event.body || '{}').query || GEOPOLITICS_QUERY)
            : GEOPOLITICS_QUERY;

        const serperRes = await fetch('https://google.serper.dev/news', {
            method: 'POST',
            headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ q: customQuery, num: 10, tbs: 'qdr:d' }) // last 24h
        });

        if (!serperRes.ok) {
            throw new Error(`Serper API error: ${serperRes.status}`);
        }

        const serperData = await serperRes.json();
        const articles = serperData.news || [];

        if (articles.length === 0) {
            return { statusCode: 200, body: JSON.stringify({ nodes: [], count: 0 }) };
        }

        // 2. For each article: text-based coord inference (always works) + optional NL API enhancement
        const nodes = [];

        await Promise.all(articles.slice(0, 10).map(async (article) => {
            const text = `${article.title}. ${article.snippet || ''}`;

            // PRIMARY: fast text-based lookup — no external API needed
            let coords = inferCoordsFromText(text);

            // ENHANCEMENT: try NL API for better entity extraction (only if GCP key available)
            let entities = null;
            if (geminiKey && coords) { // only call NL API if text already found a region
                entities = await analyzeArticle(text, geminiKey);
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
                source: article.source || 'News'
            });
        }));

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nodes, count: nodes.length })
        };

    } catch (err) {
        console.error('fetch-news error:', err);
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};
