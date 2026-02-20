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
        body: JSON.stringify({ q: query, num: numResults, gl: 'us', hl: 'en', tbs: 'qdr:m' })
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
            'Timeline': (() => {
                if (!item.date) return 'LIVE - Feb 2026';
                const parsed = new Date(item.date);
                if (!isNaN(parsed)) return `LIVE - ${parsed.toLocaleString('en-US', { month: 'short', year: 'numeric' })}`;
                // Serper sometimes returns relative strings like "2 days ago" — use as-is
                return `LIVE - ${item.date}`;
            })(),
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

        // PRIMARY: Serper — scoped to past month (tbs:qdr:m), targeting latest + ongoing conflicts
        if (serperKey) {
            const [breakingConflict, ongoingWars, geoecon, techSec] = await Promise.all([
                fetchSerper('breaking geopolitics crisis conflict 2026 latest update', serperKey, 8),
                fetchSerper('Ukraine Gaza Sudan Taiwan ceasefire offensive latest development 2026', serperKey, 7),
                fetchSerper('global economy sanctions trade war tariffs 2026', serperKey, 5),
                fetchSerper('cyber attack AI surveillance military technology 2026', serperKey, 4)
            ]);
            intelItems = [...breakingConflict, ...ongoingWars, ...geoecon, ...techSec];
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

        // ── CRITICAL MINERALS PRICING ──────────────────────────────────────
        // Static reference data for the matrix grid
        const MINERAL_REF = {
            gold: { symbol: 'Au', unit: '/oz', origins: 'China, Australia, Russia, USA', players: 'Newmont, Barrick Gold, AngloGold' },
            silver: { symbol: 'Ag', unit: '/oz', origins: 'Mexico, Peru, China, Australia', players: 'Fresnillo, Polymetal, Pan American Silver' },
            lithium: { symbol: 'Li', unit: '/t', origins: 'Australia, Chile, China, Argentina', players: 'Albemarle, SQM, Ganfeng Lithium' },
            cobalt: { symbol: 'Co', unit: '/t', origins: 'DRC (70%), Russia, Australia', players: 'Glencore, CMOC, ERG' },
            copper: { symbol: 'Cu', unit: '/lb', origins: 'Chile, Peru, DRC, China', players: 'Codelco, Freeport-McMoRan, BHP' },
            rareEarths: { symbol: 'RE', unit: '', origins: 'China (60%), Myanmar, USA, Australia', players: 'Northern Rare Earths, Lynas, MP Materials' }
        };

        let minerals = {};
        Object.keys(MINERAL_REF).forEach(k => {
            minerals[k] = { ...MINERAL_REF[k], price: null };
        });

        if (serperKey) {
            try {
                // Batch 1: precious metals
                const preciousRes = await fetch('https://google.serper.dev/search', {
                    method: 'POST',
                    headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ q: 'gold silver price per ounce today 2026', num: 5, gl: 'us', hl: 'en' })
                });
                if (preciousRes.ok) {
                    const data = await preciousRes.json();
                    // Try knowledge graph
                    const kgPrice = data.knowledgeGraph?.attributes?.['Price'] || data.knowledgeGraph?.description || '';
                    const kgMatch = kgPrice.match(/\$[\d,]+\.?\d*/);
                    if (kgMatch) minerals.gold.price = kgMatch[0];

                    for (const r of (data.organic || [])) {
                        const text = `${r.title} ${r.snippet}`;
                        if (!minerals.gold.price) {
                            const m = text.match(/gold.*?\$\s*([\d,]+\.?\d*)/i) || text.match(/\$\s*([\d,]+\.?\d*).*?(?:per\s+ounce|\/oz)/i);
                            if (m && parseInt(m[1].replace(/,/g, '')) > 1000) minerals.gold.price = `$${m[1]}`;
                        }
                        if (!minerals.silver.price) {
                            const m = text.match(/silver.*?\$\s*([\d,.]+)/i);
                            if (m && parseFloat(m[1].replace(/,/g, '')) < 200) minerals.silver.price = `$${m[1]}`;
                        }
                    }
                }

                // Batch 2: industrial minerals
                const industrialRes = await fetch('https://google.serper.dev/search', {
                    method: 'POST',
                    headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ q: 'lithium cobalt copper price 2026 per tonne', num: 5, gl: 'us', hl: 'en' })
                });
                if (industrialRes.ok) {
                    const data = await industrialRes.json();
                    for (const r of (data.organic || [])) {
                        const text = `${r.title} ${r.snippet}`;
                        if (!minerals.lithium.price) {
                            const m = text.match(/lithium.*?\$\s*([\d,]+)/i);
                            if (m && parseInt(m[1].replace(/,/g, '')) > 1000) minerals.lithium.price = `$${m[1]}`;
                        }
                        if (!minerals.cobalt.price) {
                            const m = text.match(/cobalt.*?\$\s*([\d,]+)/i);
                            if (m && parseInt(m[1].replace(/,/g, '')) > 1000) minerals.cobalt.price = `$${m[1]}`;
                        }
                        if (!minerals.copper.price) {
                            const m = text.match(/copper.*?\$\s*([\d,.]+)/i);
                            if (m) minerals.copper.price = `$${m[1]}`;
                        }
                    }
                }

                // Rare earths supply status
                const reRes = await fetch('https://google.serper.dev/search', {
                    method: 'POST',
                    headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ q: 'rare earth minerals supply chain status 2026', num: 2, gl: 'us', hl: 'en' })
                });
                if (reRes.ok) {
                    const reData = await reRes.json();
                    const snippet = reData.organic?.[0]?.snippet || '';
                    if (/shortage|crisis|disruption|restrict|ban|tension/i.test(snippet)) minerals.rareEarths.price = '⚠ CONSTRAINED';
                    else if (/stable|surplus|growth/i.test(snippet)) minerals.rareEarths.price = '✅ STABLE';
                    else minerals.rareEarths.price = '⬤ MONITORED';
                }
            } catch (mineralErr) {
                console.log('[fetch-intel] Mineral pricing skipped:', mineralErr.message);
            }
        }
        // If no items scraped (no API key or all failed), load static fallback
        if (intelItems.length === 0) {
            try {
                const fs = require('fs');
                const path = require('path');
                const staticPath = path.join(__dirname, '../../public/live_intel.json');
                const fallbackData = JSON.parse(fs.readFileSync(staticPath, 'utf8'));
                intelItems = fallbackData.map(item => ({ ...item, isScraped: true }));
            } catch (_) {
                // No static fallback available either
            }
        }

        const payload = { items: intelItems, minerals };
        cache = { data: payload, timestamp: now };
        return { statusCode: 200, headers, body: JSON.stringify(payload) };

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
