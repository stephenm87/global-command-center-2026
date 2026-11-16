/**
 * nexusGDELT.js — GDELT pulse integration routed through cached Netlify function
 * Keeps browser runtime free of direct third-party API calls and respects CDN caching.
 */

const GDELT_PROXY_ENDPOINT = '/.netlify/functions/gdelt-pulse';
const PULSE_TOPIC_COUNT = 8;

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

function detectAnchors(text) {
    const t = String(text || '').toLowerCase();
    const found = new Set();

    Object.entries(COUNTRY_TO_ANCHOR).forEach(([keyword, anchor]) => {
        if (t.includes(keyword.toLowerCase())) found.add(anchor);
    });

    Object.entries(THEME_KEYWORDS).forEach(([anchor, keywords]) => {
        if (keywords.some(kw => t.includes(kw))) found.add(anchor);
    });

    return [...found];
}

export async function fetchGDELTArticles(topicIndex = 0) {
    try {
        const safeIndex = Math.abs(Number.parseInt(topicIndex, 10) || 0) % PULSE_TOPIC_COUNT;
        const response = await fetch(`${GDELT_PROXY_ENDPOINT}?topic=${safeIndex}`);
        if (!response.ok) return [];
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) return [];
        const data = await response.json();
        if (!Array.isArray(data?.articles)) return [];

        return data.articles.map(article => ({
            title: article.title || '',
            url: article.url || '',
            domain: article.domain || '',
            date: article.seendate || '',
            language: article.language || 'en',
            tone: Number.parseFloat(article.tone) || 0,
            anchors: detectAnchors(article.title || ''),
        }));
    } catch {
        return [];
    }
}

export async function fetchGlobalPulse() {
    const topicIndex = Math.floor(Math.random() * PULSE_TOPIC_COUNT);
    return fetchGDELTArticles(topicIndex);
}
