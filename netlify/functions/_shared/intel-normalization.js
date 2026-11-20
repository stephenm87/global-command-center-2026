// Specific countries, territories, cities, and sub-regions (checked before continents, longest key first).
// Never include "un" (a UN-published story is not located in New York) or bare "america" (ambiguous with Central/Latin/South America).
const SPECIFIC_PLACE_COORDS = Object.freeze({
    // Africa
    'democratic republic of the congo': [-4.0, 21.8],
    'central african republic': [6.6, 20.9],
    'south sudan': [6.9, 31.3],
    'south africa': [-30.6, 22.9],
    'burkina faso': [12.2, -1.6],
    'horn of africa': [8.0, 45.0],
    'dr congo': [-4.0, 21.8],
    'el fasher': [13.6, 25.3],
    somaliland: [9.6, 44.1],
    mozambique: [-18.7, 35.5],
    ethiopia: [9.1, 40.5],
    cameroon: [7.4, 12.4],
    tanzania: [-6.4, 34.9],
    zimbabwe: [-19.0, 29.2],
    khartoum: [15.5, 32.6],
    kinshasa: [-4.3, 15.3],
    somalia: [5.2, 46.2],
    nigeria: [9.1, 8.7],
    senegal: [14.5, -14.5],
    burundi: [-3.4, 29.9],
    darfur: [13.6, 25.3],
    rwanda: [-1.9, 29.9],
    uganda: [1.4, 32.3],
    sudan: [12.9, 30.2],
    congo: [-4.0, 21.8],
    kenya: [-0.02, 37.9],
    ghana: [7.9, -1.0],
    niger: [17.6, 8.1],
    sahel: [14.5, 2.0],
    mali: [17.6, -4.0],
    chad: [15.5, 18.7],
    goma: [-1.7, 29.2],
    drc: [-4.0, 21.8],

    // Middle East & North Africa
    'united arab emirates': [24.5, 54.4],
    'western sahara': [24.2, -12.9],
    'bab el-mandeb': [12.6, 43.3],
    'saudi arabia': [23.9, 45.1],
    'persian gulf': [26.8, 51.5],
    'west bank': [31.9, 35.3],
    palestine: [31.9, 35.2],
    algeria: [28.0, 1.7],
    morocco: [31.8, -7.1],
    tunisia: [33.9, 9.5],
    lebanon: [33.9, 35.9],
    bahrain: [26.0, 50.6],
    'red sea': [20.0, 38.5],
    israel: [31.0, 34.9],
    jordan: [30.6, 36.2],
    kuwait: [29.3, 47.5],
    hormuz: [26.6, 56.3],
    syria: [34.8, 38.9],
    yemen: [15.6, 48.5],
    libya: [26.3, 17.2],
    egypt: [26.8, 30.8],
    qatar: [25.4, 51.2],
    gaza: [31.5, 34.5],
    iran: [32.4, 53.7],
    iraq: [33.2, 43.7],
    oman: [21.5, 55.9],
    uae: [24.5, 54.4],

    // Asia-Pacific & Central Asia
    'south china sea': [14.0, 114.0],
    'north korea': [40.3, 127.5],
    'south korea': [36.5, 127.9],
    'central asia': [42.0, 68.0],
    'hong kong': [22.3, 114.2],
    'sri lanka': [7.9, 80.8],
    turkmenistan: [39.0, 59.6],
    afghanistan: [33.9, 67.7],
    philippines: [12.9, 121.8],
    bangladesh: [23.7, 90.4],
    kyrgyzstan: [41.2, 74.8],
    tajikistan: [38.9, 71.3],
    kazakhstan: [48.0, 66.9],
    uzbekistan: [41.4, 64.6],
    indonesia: [-0.8, 113.9],
    singapore: [1.35, 103.8],
    pakistan: [30.4, 69.3],
    thailand: [15.9, 101.0],
    cambodia: [12.6, 105.0],
    malaysia: [4.2, 101.9],
    myanmar: [19.2, 96.7],
    vietnam: [14.1, 108.3],
    kashmir: [34.1, 74.8],
    taiwan: [23.7, 120.9],
    china: [35.9, 104.2],
    india: [20.6, 79.0],
    japan: [36.2, 138.3],
    korea: [36.5, 127.9],
    nepal: [28.4, 84.1],
    indus: [30.0, 71.0],
    laos: [19.9, 102.5],

    // Europe & Eurasia
    'european union': [50.8, 4.3],
    'united kingdom': [55.4, -3.4],
    transnistria: [46.8, 29.6],
    azerbaijan: [40.1, 47.6],
    greenland: [64.2, -51.7],
    belarus: [53.7, 27.9],
    moldova: [47.4, 28.4],
    georgia: [42.3, 43.4],
    armenia: [40.1, 45.0],
    ukraine: [49.0, 31.2],
    germany: [51.2, 10.5],
    britain: [55.4, -3.4],
    denmark: [56.3, 9.5],
    finland: [61.9, 25.7],
    iceland: [64.9, -19.0],
    balkans: [43.0, 20.0],
    brussels: [50.8, 4.3],
    türkiye: [38.9, 35.2],
    russia: [61.5, 105.3],
    france: [46.2, 2.2],
    turkey: [38.9, 35.2],
    cyprus: [35.1, 33.4],
    greece: [39.1, 21.8],
    poland: [51.9, 19.1],
    norway: [60.5, 8.5],
    sweden: [60.1, 18.6],
    serbia: [44.0, 21.0],
    kosovo: [42.6, 20.9],
    bosnia: [43.9, 17.7],
    arctic: [75.0, -40.0],
    geneva: [46.2, 6.1],
    spain: [40.5, -3.7],
    italy: [41.9, 12.6],
    nato: [50.8, 4.3],
    uk: [55.4, -3.4],

    // Americas & Caribbean
    'dominican republic': [18.7, -70.2],
    'central america': [13.8, -86.2],
    'united states': [37.1, -95.6],
    'el salvador': [13.8, -88.9],
    'costa rica': [9.7, -83.8],
    venezuela: [6.4, -66.6],
    argentina: [-38.4, -63.6],
    guatemala: [15.8, -90.2],
    nicaragua: [12.9, -85.2],
    colombia: [4.6, -74.1],
    honduras: [15.2, -86.2],
    trinidad: [10.7, -61.2],
    ecuador: [-1.8, -78.2],
    bolivia: [-16.3, -63.6],
    jamaica: [18.1, -77.3],
    mexico: [23.6, -102.5],
    brazil: [-14.2, -51.9],
    guyana: [4.9, -58.9],
    panama: [8.5, -80.8],
    canada: [56.1, -106.3],
    haiti: [18.9, -72.3],
    chile: [-35.7, -71.5],
    peru: [-9.2, -75.0],
    cuba: [21.5, -77.8],
    'u.s.a.': [37.1, -95.6],
    'u.s.': [37.1, -95.6],
    usa: [37.1, -95.6],

    // Pacific Islands & Oceania
    'papua new guinea': [-6.3, 143.9],
    'marshall islands': [7.1, 171.2],
    'solomon islands': [-9.6, 160.2],
    'new caledonia': [-20.9, 165.6],
    'new zealand': [-40.9, 174.9],
    micronesia: [7.4, 150.6],
    australia: [-25.3, 133.8],
    kiribati: [1.9, -157.4],
    vanuatu: [-15.4, 166.9],
    tuvalu: [-7.1, 177.6],
    samoa: [-13.8, -172.1],
    tonga: [-21.2, -175.2],
    nauru: [-0.5, 166.9],
    palau: [7.5, 134.6],
    fiji: [-17.7, 178.1],
});

const CONTINENT_COORDS = Object.freeze({
    'latin america': [-8.0, -63.0],
    'south america': [-14.0, -60.0],
    'pacific islands': [-13.5, 172.0],
    'middle east': [27.5, 42.0],
    caribbean: [18.2, -72.5],
    oceania: [-18.0, 165.0],
    europe: [50.8, 15.3],
    africa: [6.5, 21.8],
    asia: [28.0, 100.0],
});

const REGION_COORDS = Object.freeze({
    ...SPECIFIC_PLACE_COORDS,
    ...CONTINENT_COORDS,
});

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compileMatchers(table) {
    return Object.entries(table)
        .sort((a, b) => b[0].length - a[0].length)
        .map(([key, coords]) => ({
            key,
            coords,
            pattern: new RegExp(`(?<![a-z0-9])${escapeRegex(key)}(?![a-z0-9])`, 'i'),
        }));
}

const SPECIFIC_MATCHERS = compileMatchers(SPECIFIC_PLACE_COORDS);
const CONTINENT_MATCHERS = compileMatchers(CONTINENT_COORDS);

const SECTOR_LABELS = {
    'Geopolitics & Conflict': 'Geopolitics / Conflict',
    'Governance & Rights': 'Governance / Human Rights',
    'Economy & Trade': 'Economy / Global',
    'Environment & Energy': 'Environment / Energy',
    'Technology & Science': 'Technology / Security',
    'Health & Society': 'Health / Society',
};

function findFirstMatch(text, matchers) {
    const value = String(text || '');
    if (!value) return null;
    for (const entry of matchers) {
        if (entry.pattern.test(value)) return entry;
    }
    return null;
}

function resolveCoords(title, snippet = '') {
    const titleSpecific = findFirstMatch(title, SPECIFIC_MATCHERS);
    if (titleSpecific) {
        return { coords: titleSpecific.coords, matchedPlace: titleSpecific.key, precision: 'named-place' };
    }
    const snippetSpecific = findFirstMatch(snippet, SPECIFIC_MATCHERS);
    if (snippetSpecific) {
        return { coords: snippetSpecific.coords, matchedPlace: snippetSpecific.key, precision: 'named-place' };
    }
    const titleContinent = findFirstMatch(title, CONTINENT_MATCHERS);
    if (titleContinent) {
        return { coords: titleContinent.coords, matchedPlace: titleContinent.key, precision: 'regional' };
    }
    const snippetContinent = findFirstMatch(snippet, CONTINENT_MATCHERS);
    if (snippetContinent) {
        return { coords: snippetContinent.coords, matchedPlace: snippetContinent.key, precision: 'regional' };
    }
    return { coords: [20.0, 0.0], matchedPlace: null, precision: 'fallback' };
}

function getCoords(title, snippet = '') {
    return resolveCoords(title, snippet).coords;
}

function categorizeSector(text) {
    const value = String(text || '').toLowerCase();
    if (/war|conflict|military|attack|missile|sanction|nato|nuclear|troops|coup|siege|weapons|drone/.test(value))
        return 'Geopolitics & Conflict';
    if (/\b(?:elections?|parliaments?|constitutional|judiciar(?:y|ies)|human rights|indigenous|democrac(?:y|ies)|civil liberties|referendums?|self-determination|co-governance)\b/.test(value))
        return 'Governance & Rights';
    if (/economy|economic|trade|gdp|inflation|tariff|market|debt|recession|bank|finance|investment|development|labor|worker|employment|currency|export|import|commodity|supply chain|crypto/.test(value))
        return 'Economy & Trade';
    if (/climate|energy|oil|gas|carbon|emissions|environment|water|ocean|mineral|biodiversity|forest|flooding|drought|cop/.test(value))
        return 'Environment & Energy';
    if (/\bai\b|artificial intelligence|tech|cyber|hack|satellite|space|chip|semiconductor|quantum|digital|information governance|surveillance/.test(value))
        return 'Technology & Science';
    if (/health|pandemic|disease|outbreak|vaccine|hospital|mental|food crisis|famine|refugee|migration|displacement|humanitarian/.test(value))
        return 'Health & Society';
    return 'Geopolitics & Conflict';
}

function normalizeHttpsUrl(rawUrl) {
    try {
        const url = new URL(rawUrl);
        if (url.protocol !== 'https:') return '';
        for (const key of [...url.searchParams.keys()]) {
            if (/^(utm_|gclid|fbclid)/i.test(key)) url.searchParams.delete(key);
        }
        url.hash = '';
        return url.toString();
    } catch {
        return '';
    }
}

function normalizeProviderArticle(item, scraperSource = 'serper') {
    const url = normalizeHttpsUrl(item?.link || item?.url);
    if (!url || !item?.title) return null;
    const title = String(item.title).trim();
    const snippet = String(item.snippet || item.description || '').trim();
    const combined = `${title} ${snippet}`;
    const category = categorizeSector(combined);
    const resolved = resolveCoords(title, snippet);
    const [lat, lng] = resolved.coords;
    const publishedAt = item.date || item.publishedAt || null;

    return {
        'Topic/Sector': SECTOR_LABELS[category],
        'Entity/Subject': title,
        'Key Player/Organization': item.source?.name || item.source || 'Global News',
        'Timeline': publishedAt ? `CURRENT — ${publishedAt}` : 'CURRENT — date unavailable',
        'Expected Impact/Value': snippet || title,
        'Source': item.source?.name || item.source || 'Global News',
        url,
        'Latitude': String(lat),
        'Longitude': String(lng),
        'Broad_Category': category,
        isScraped: true,
        isLive: true,
        _contentStatus: 'provider-current',
        _scraperSource: scraperSource,
        _coordPrecision: resolved.precision,
        _matchedPlace: resolved.matchedPlace,
        publishedAt,
    };
}

module.exports = {
    CONTINENT_COORDS,
    REGION_COORDS,
    SECTOR_LABELS,
    SPECIFIC_PLACE_COORDS,
    categorizeSector,
    getCoords,
    normalizeHttpsUrl,
    normalizeProviderArticle,
    resolveCoords,
};
