const REGION_COORDS = {
    ukraine: [49.0, 31.2], russia: [61.5, 105.3],
    gaza: [31.5, 34.5], israel: [31.0, 34.9], palestine: [31.9, 35.2],
    iran: [32.4, 53.7], iraq: [33.2, 43.7], syria: [34.8, 38.9],
    china: [35.9, 104.2], taiwan: [23.7, 120.9], 'hong kong': [22.3, 114.2],
    'north korea': [40.3, 127.5], korea: [36.5, 127.9],
    usa: [37.1, -95.6], 'united states': [37.1, -95.6], america: [37.1, -95.6],
    europe: [54.5, 15.3], germany: [51.2, 10.5], france: [46.2, 2.2],
    uk: [55.4, -3.4], britain: [55.4, -3.4], nato: [50.8, 4.3], un: [40.7, -74.0],
    africa: [8.8, 26.8], sudan: [12.9, 30.2], ethiopia: [9.1, 40.5],
    somalia: [5.2, 46.2], nigeria: [9.1, 8.7], congo: [-4.0, 21.8],
    india: [20.6, 79.0], pakistan: [30.4, 69.3], afghanistan: [33.9, 67.7],
    myanmar: [19.2, 96.7], thailand: [15.9, 101.0], philippines: [12.9, 121.8],
    japan: [36.2, 138.3], 'south china sea': [14.0, 114.0],
    venezuela: [6.4, -66.6], colombia: [4.6, -74.1], mexico: [23.6, -102.5],
    brazil: [-14.2, -51.9], haiti: [18.9, -72.3],
    turkey: [38.9, 35.2], 'saudi arabia': [23.9, 45.1], yemen: [15.6, 48.5],
};

const SECTOR_LABELS = {
    'Geopolitics & Conflict': 'Geopolitics / Conflict',
    'Economy & Trade': 'Economy / Global',
    'Environment & Energy': 'Environment / Energy',
    'Technology & Science': 'Technology / Security',
    'Health & Society': 'Health / Society',
};

function getCoords(text) {
    const lower = String(text || '').toLowerCase();
    for (const [key, coords] of Object.entries(REGION_COORDS)) {
        if (lower.includes(key)) return coords;
    }
    return [20.0, 0.0];
}

function categorizeSector(text) {
    const value = String(text || '').toLowerCase();
    if (/war|conflict|military|attack|missile|sanction|nato|nuclear|troops|coup|siege|weapons|drone/.test(value))
        return 'Geopolitics & Conflict';
    if (/economy|trade|gdp|inflation|tariff|market|debt|recession|bank|supply chain|crypto/.test(value))
        return 'Economy & Trade';
    if (/climate|energy|oil|gas|carbon|emissions|environment|flooding|drought|cop/.test(value))
        return 'Environment & Energy';
    if (/ai|tech|cyber|hack|satellite|space|chip|quantum|digital|surveillance/.test(value))
        return 'Technology & Science';
    if (/health|pandemic|disease|vaccine|hospital|mental|food crisis|famine|refugee|humanitarian/.test(value))
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
    const combined = `${item.title} ${item.snippet || item.description || ''}`;
    const category = categorizeSector(combined);
    const [lat, lng] = getCoords(combined);
    const publishedAt = item.date || item.publishedAt || null;

    return {
        'Topic/Sector': SECTOR_LABELS[category],
        'Entity/Subject': String(item.title).trim(),
        'Key Player/Organization': item.source?.name || item.source || 'Global News',
        'Timeline': publishedAt ? `CURRENT — ${publishedAt}` : 'CURRENT — date unavailable',
        'Expected Impact/Value': item.snippet || item.description || item.title,
        'Source': item.source?.name || item.source || 'Global News',
        url,
        'Latitude': String(lat),
        'Longitude': String(lng),
        'Broad_Category': category,
        isScraped: true,
        isLive: true,
        _contentStatus: 'provider-current',
        _scraperSource: scraperSource,
        publishedAt,
    };
}

module.exports = {
    REGION_COORDS,
    SECTOR_LABELS,
    categorizeSector,
    getCoords,
    normalizeHttpsUrl,
    normalizeProviderArticle,
};
