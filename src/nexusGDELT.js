/**
 * nexusGDELT.js — GDELT API integration for real-time event data
 * Uses GDELT's free GKG (Global Knowledge Graph) and Events API
 * No API key needed.
 */

const GDELT_DOC_API = 'https://api.gdeltproject.org/api/v2/doc/doc';

// Map GDELT themes to our anchor node IDs
const COUNTRY_TO_ANCHOR = {
    'US': 'USA', 'United States': 'USA', 'China': 'China', 'Russia': 'Russia',
    'United Kingdom': 'Europe', 'France': 'Europe', 'Germany': 'Europe', 'EU': 'Europe',
    'Iran': 'MiddleEast', 'Saudi Arabia': 'MiddleEast', 'Israel': 'MiddleEast', 'Iraq': 'MiddleEast', 'Yemen': 'MiddleEast',
    'Nigeria': 'Africa', 'Sudan': 'Africa', 'Kenya': 'Africa', 'South Africa': 'Africa', 'Ethiopia': 'Africa', 'Mali': 'Africa',
    'Japan': 'AsiaPacific', 'Taiwan': 'AsiaPacific', 'South Korea': 'AsiaPacific', 'India': 'AsiaPacific', 'Philippines': 'AsiaPacific',
    'Brazil': 'LatinAmerica', 'Mexico': 'LatinAmerica', 'Colombia': 'LatinAmerica', 'Argentina': 'LatinAmerica',
    'NATO': 'NATO', 'United Nations': 'UN_OPEC', 'OPEC': 'UN_OPEC',
};

const THEME_KEYWORDS = {
    'Jihadist': ['isis', 'al qaeda', 'boko haram', 'jihadist', 'islamic state', 'al-shabaab'],
    'MilitantPMC': ['wagner', 'rsf', 'militia', 'paramilitary', 'mercenary'],
    'Hezbollah': ['hezbollah', 'houthi', 'axis of resistance', 'iran proxy'],
    'Cartels': ['cartel', 'fentanyl', 'narco', 'sinaloa', 'drug trafficking'],
    'CyberActors': ['cyberattack', 'ransomware', 'apt28', 'hacking', 'cyber espionage'],
    'TechAIHub': ['semiconductor', 'nvidia', 'tsmc', 'asml', 'artificial intelligence'],
    'BiotechHub': ['pharma', 'ozempic', 'vaccine', 'drug approval', 'biotech'],
};

/**
 * Fetch recent articles from GDELT matching a query
 * @param {string} query - search query
 * @param {number} maxRecords - max articles to return
 * @returns {Promise<Array>} articles with title, url, domain, date, tone, source/target anchors
 */
export async function fetchGDELTArticles(query = 'geopolitics', maxRecords = 50) {
    try {
        const url = `${GDELT_DOC_API}?query=${encodeURIComponent(query)}&mode=ArtList&maxrecords=${maxRecords}&format=json&sort=DateDesc`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`GDELT API error: ${response.status}`);
        const data = await response.json();

        if (!data.articles) return [];

        return data.articles.map(article => ({
            title: article.title || '',
            url: article.url || '',
            domain: article.domain || '',
            date: article.seendate || '',
            language: article.language || 'en',
            tone: parseFloat(article.tone) || 0,
            socialImage: article.socialimage || '',
            // Map to our anchor nodes
            anchors: detectAnchors(article.title || ''),
        }));
    } catch (err) {
        console.warn('[GDELT] Fetch failed:', err.message);
        return [];
    }
}

/**
 * Detect which anchor nodes an article title/text mentions
 */
function detectAnchors(text) {
    const t = text.toLowerCase();
    const found = new Set();

    // Country mapping
    Object.entries(COUNTRY_TO_ANCHOR).forEach(([keyword, anchor]) => {
        if (t.includes(keyword.toLowerCase())) found.add(anchor);
    });

    // Theme keywords
    Object.entries(THEME_KEYWORDS).forEach(([anchor, keywords]) => {
        if (keywords.some(kw => t.includes(kw))) found.add(anchor);
    });

    return [...found];
}

/**
 * Fetch events for a specific pair of actors (for edge enrichment)
 */
export async function fetchEdgeEvents(actor1Query, actor2Query, maxRecords = 10) {
    try {
        const query = `"${actor1Query}" "${actor2Query}"`;
        const url = `${GDELT_DOC_API}?query=${encodeURIComponent(query)}&mode=ArtList&maxrecords=${maxRecords}&format=json&sort=DateDesc`;
        const response = await fetch(url);
        if (!response.ok) return [];
        const data = await response.json();
        return (data.articles || []).map(a => ({
            title: a.title || '',
            url: a.url || '',
            date: a.seendate || '',
            tone: parseFloat(a.tone) || 0,
        }));
    } catch (err) {
        console.warn('[GDELT] Edge fetch failed:', err.message);
        return [];
    }
}

/**
 * Multi-topic fetch — gets articles across several geopolitical themes
 */
export async function fetchGlobalPulse() {
    const queries = [
        'China United States trade',
        'Russia NATO military',
        'Sudan conflict RSF',
        'semiconductor TSMC chip',
        'Iran Israel Hezbollah',
        'fentanyl cartel Mexico',
        'cyberattack ransomware',
        'Wagner Africa',
    ];

    // Pick 1 random query per cycle to respect 5-second rate limit
    const query = queries[Math.floor(Math.random() * queries.length)];
    return await fetchGDELTArticles(query, 10);
}
