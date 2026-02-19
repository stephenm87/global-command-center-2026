// fetch-intel.js - Multi-source live geopolitical news scraper
// Sources: Serper (primary) → GNews (backup)
// Cached 30 min to preserve free-tier quotas

const CACHE_DURATION_MS = 30 * 60 * 1000;
let cache = { data: null, timestamp: 0 };

// Simple keyword → coordinates lookup for geolocating headlines
const REGION_COORDS = {
    ukraine: [49.0, 31.2], russia: [61.5, 105.3],
    gaza: [31.5, 34.5], israel: [31.0, 34.9], palestine: [31.9, 35.2],
    iran: [32.4, 53.7], iraq: [33.2, 43.7], syria: [34.8, 38.9],
    china: [35.9, 104.2], taiwan: [23.7, 120.9], 'hong kong': [22.3, 114.2],
    'north korea': [40.3, 127.5], korea: [36.5, 127.9],
    usa: [37.1, -95.6], 'united states': [37.1, -95.6], america: [37.1, -95.6],
    europe: [54.5, 15.3], germany: [51.2, 10.5], france: [46.2, 2.2],
    uk: [55.4, -3.4], britain: [55.4, -3.4], ukraine: [49.0, 31.2],
    nato: [50.8, 4.3], un: [40.7, -74.0],
    africa: [8.8, 26.8], sudan: [12.9, 30.2], ethiopia: [9.1, 40.5],
    somalia: [5.2, 46.2], nigeria: [9.1, 8.7], congo: [-4.0, 21.8],
    india: [20.6, 79.0], pakistan: [30.4, 69.3], afghanistan: [33.9, 67.7],
    myanmar: [19.2, 96.7], thailand: [15.9, 101.0], philippines: [12.9, 121.8],
    japan: [36.2, 138.3], 'south china sea': [14.0, 114.0],
    venezuela: [6.4, -66.6], colombia: [4.6, -74.1], mexico: [23.6, -102.5],
    brazil: [-14.2, -51.9], haiti: [18.9, -72.3],
    turkey: [38.9, 35.2], 'saudi arabia': [23.9, 45.1], yemen: [15.6, 48.5]
};

function getCoords(text) {
    const lower = (text || '').toLowerCase();
    for (const [key, coords] of Object.entries(REGION_COORDS)) {
        if (lower.includes(key)) return coords;
    }
    return [20.0, 0.0]; // Global default
}

function categorizeSector(text) {
    const t = (text || '').toLowerCase();
    if (/war|conflict|military|attack|missile|sanction|nato|nuclear|troops|coup|siege|weapons|drone/.test(t))
        return 'Geopolitics & Conflict';
    if (/economy|trade|gdp|inflation|tariff|market|debt|recession|bank|supply chain|crypto/.test(t))
        return 'Economy & Trade';
    if (/climate|energy|oil|gas|carbon|emissions|environment|flooding|drought|cop/.test(t))
        return 'Environment & Energy';
    if (/ai|tech|cyber|hack|satellite|space|chip|quantum|digital|surveillance/.test(t))
        return 'Technology & Science';
    if (/health|pandemic|disease|vaccine|hospital|mental|food crisis|famine/.test(t))
        return 'Health & Society';
    return 'Geopolitics & Conflict';
}

const SECTOR_LABELS = {
    'Geopolitics & Conflict': 'Geopolitics / Conflict',
    'Economy & Trade': 'Economy / Global',
    'Environment & Energy': 'Environment / Energy',
    'Technology & Science': 'Technology / Security',
    'Health & Society': 'Health / Society',
};

// ── SERPER ──────────────────────────────────────────────────────────────────
async function fetchSerper(query, apiKey, numResults = 8) {
    const res = await fetch('https://google.serper.dev/news', {
        method: 'POST',
        headers: {
            'X-API-KEY': apiKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ q: query, num: numResults, gl: 'us', hl: 'en' })
    });
    if (!res.ok) throw new Error(`Serper error: ${res.status}`);
    const data = await res.json();
    return (data.news || []).map(item => {
        const category = categorizeSector(`${item.title} ${item.snippet}`);
        const [lat, lng] = getCoords(`${item.title} ${item.snippet}`);
        return {
            'Topic/Sector': SECTOR_LABELS[category],
            'Entity/Subject': item.title,
            'Key Player/Organization': item.source || 'Global News',
            'Timeline': `LIVE - ${new Date(item.date || Date.now()).toLocaleString('en-US', { month: 'short', year: 'numeric' })}`,
            'Expected Impact/Value': item.snippet || item.title,
            'Source': item.source || 'Google News',
            'url': item.link,
            'Latitude': String(lat),
            'Longitude': String(lng),
            'Broad_Category': category,
            'isScraped': true,
            '_scraperSource': 'serper'
        };
    });
}

// ── GNEWS (backup) ───────────────────────────────────────────────────────────
async function fetchGNews(query, apiKey, max = 8) {
    const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=en&country=any&max=${max}&sortby=publishedAt&token=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`GNews error: ${res.status}`);
    const data = await res.json();
    return (data.articles || []).map(article => {
        const combined = `${article.title} ${article.description}`;
        const category = categorizeSector(combined);
        const [lat, lng] = getCoords(combined);
        return {
            'Topic/Sector': SECTOR_LABELS[category],
            'Entity/Subject': article.title,
            'Key Player/Organization': article.source?.name || 'Global News',
            'Timeline': `LIVE - ${new Date(article.publishedAt || Date.now()).toLocaleString('en-US', { month: 'short', year: 'numeric' })}`,
            'Expected Impact/Value': article.description || article.title,
            'Source': article.source?.name || 'GNews',
            'url': article.url,
            'Latitude': String(lat),
            'Longitude': String(lng),
            'Broad_Category': category,
            'isScraped': true,
            '_scraperSource': 'gnews'
        };
    });
}

// ── HANDLER ──────────────────────────────────────────────────────────────────
exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=1800'
    };

    try {
        // Return cached data if still fresh
        const now = Date.now();
        if (cache.data && (now - cache.timestamp) < CACHE_DURATION_MS) {
            return { statusCode: 200, headers, body: JSON.stringify(cache.data) };
        }

        const serperKey = process.env.SERPER_API_KEY;
        const gnewsKey = process.env.GNEWS_API_KEY;

        let intelItems = [];

        // PRIMARY: Serper (Google News quality results)
        if (serperKey) {
            const [conflictNews, econNews, techNews] = await Promise.all([
                fetchSerper('geopolitics war conflict military 2025', serperKey, 8),
                fetchSerper('global economy trade sanctions inflation', serperKey, 5),
                fetchSerper('cybersecurity AI technology surveillance', serperKey, 4)
            ]);
            intelItems = [...conflictNews, ...econNews, ...techNews];
        }

        // BACKUP: GNews (if Serper unavailable or too few results)
        if (intelItems.length < 5 && gnewsKey) {
            const [conflictBack, econBack] = await Promise.all([
                fetchGNews('geopolitics war conflict UN sanctions', gnewsKey, 8),
                fetchGNews('global economy trade inflation crisis', gnewsKey, 5)
            ]);
            intelItems = [...intelItems, ...conflictBack, ...econBack];
        }

        // Deduplicate by URL
        const seen = new Set();
        intelItems = intelItems.filter(item => {
            if (!item.url || seen.has(item.url)) return false;
            seen.add(item.url);
            return true;
        });

        cache = { data: intelItems, timestamp: now };
        return { statusCode: 200, headers, body: JSON.stringify(intelItems) };

    } catch (error) {
        console.error('[fetch-intel] Error:', error.message);

        // Graceful fallback to static file
        try {
            const fs = require('fs');
            const path = require('path');
            const staticPath = path.join(__dirname, '../../public/live_intel.json');
            const fallback = JSON.parse(fs.readFileSync(staticPath, 'utf8'));
            return {
                statusCode: 200,
                headers: { ...headers, 'X-Fallback': 'static' },
                body: JSON.stringify(fallback)
            };
        } catch (_) {
            return { statusCode: 200, headers, body: JSON.stringify([]) };
        }
    }
};
