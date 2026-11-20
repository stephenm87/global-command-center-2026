const GDELT_DOC_API = 'https://api.gdeltproject.org/api/v2/doc/doc';
const RELIEFWEB_API_V2 = 'https://api.reliefweb.int/v2/reports';
const FREE_FEED_TIMEOUT_MS = 8000;
const GDELT_TIMEOUT_MS = 6000;
const MAX_ITEM_AGE_DAYS = 30;
const MAX_URL_DATE_DRIFT_DAYS = 30;
const MAX_SNIPPET_CHARS = 220;
const DAY_MS = 24 * 60 * 60 * 1000;

const UN_NEWS_ATTRIBUTION_URL = 'https://news.un.org/en/';
const UN_NEWS_FUNDING_LABEL = 'UN institutional reporting';

const UN_NEWS_FEEDS = Object.freeze([
    {
        id: 'un-news-africa',
        region: 'Africa',
        issueHints: ['Health & Human Security', 'Security & Diplomacy', 'Governance & Rights'],
        fallbackCoords: [4.8, 21.4],
        url: 'https://news.un.org/feed/subscribe/en/news/region/africa/feed/rss.xml',
        sourceName: 'UN News',
        fundingLabel: UN_NEWS_FUNDING_LABEL,
        attributionUrl: UN_NEWS_ATTRIBUTION_URL,
        maxItems: 5,
    },
    {
        id: 'un-news-asia-pacific',
        region: 'Asia-Pacific',
        issueHints: ['Security & Diplomacy', 'Economy & Development', 'Climate & Resources'],
        fallbackCoords: [24.2, 108.0],
        url: 'https://news.un.org/feed/subscribe/en/news/region/asia-pacific/feed/rss.xml',
        sourceName: 'UN News',
        fundingLabel: UN_NEWS_FUNDING_LABEL,
        attributionUrl: UN_NEWS_ATTRIBUTION_URL,
        maxItems: 5,
    },
    {
        id: 'un-news-middle-east',
        region: 'Middle East & North Africa',
        issueHints: ['Health & Human Security', 'Security & Diplomacy', 'Governance & Rights'],
        fallbackCoords: [27.5, 38.0],
        url: 'https://news.un.org/feed/subscribe/en/news/region/middle-east/feed/rss.xml',
        sourceName: 'UN News',
        fundingLabel: UN_NEWS_FUNDING_LABEL,
        attributionUrl: UN_NEWS_ATTRIBUTION_URL,
        maxItems: 5,
    },
    {
        id: 'un-news-europe',
        region: 'Europe & Eurasia',
        issueHints: ['Security & Diplomacy', 'Governance & Rights', 'Economy & Development'],
        fallbackCoords: [50.8, 28.0],
        url: 'https://news.un.org/feed/subscribe/en/news/region/europe/feed/rss.xml',
        sourceName: 'UN News',
        fundingLabel: UN_NEWS_FUNDING_LABEL,
        attributionUrl: UN_NEWS_ATTRIBUTION_URL,
        maxItems: 5,
    },
    {
        id: 'un-news-americas',
        region: 'Americas & Caribbean',
        issueHints: ['Governance & Rights', 'Economy & Development', 'Health & Human Security'],
        fallbackCoords: [7.8, -73.0],
        url: 'https://news.un.org/feed/subscribe/en/news/region/americas/feed/rss.xml',
        sourceName: 'UN News',
        fundingLabel: UN_NEWS_FUNDING_LABEL,
        attributionUrl: UN_NEWS_ATTRIBUTION_URL,
        maxItems: 5,
    },
    {
        id: 'un-news-climate',
        region: 'Global / Transnational',
        issueHints: ['Climate & Resources', 'Economy & Development'],
        fallbackCoords: null,
        url: 'https://news.un.org/feed/subscribe/en/news/topic/climate-change/feed/rss.xml',
        sourceName: 'UN News',
        fundingLabel: UN_NEWS_FUNDING_LABEL,
        attributionUrl: UN_NEWS_ATTRIBUTION_URL,
        maxItems: 4,
    },
    {
        id: 'un-news-health',
        region: 'Global / Transnational',
        issueHints: ['Health & Human Security', 'Governance & Rights'],
        fallbackCoords: null,
        url: 'https://news.un.org/feed/subscribe/en/news/topic/health/feed/rss.xml',
        sourceName: 'UN News',
        fundingLabel: UN_NEWS_FUNDING_LABEL,
        attributionUrl: UN_NEWS_ATTRIBUTION_URL,
        maxItems: 4,
    },
    {
        id: 'un-news-human-rights',
        region: 'Global / Transnational',
        issueHints: ['Governance & Rights', 'Health & Human Security'],
        fallbackCoords: null,
        url: 'https://news.un.org/feed/subscribe/en/news/topic/human-rights/feed/rss.xml',
        sourceName: 'UN News',
        fundingLabel: UN_NEWS_FUNDING_LABEL,
        attributionUrl: UN_NEWS_ATTRIBUTION_URL,
        maxItems: 4,
    },
    {
        id: 'un-news-economic-development',
        region: 'Global / Transnational',
        issueHints: ['Economy & Development', 'Climate & Resources'],
        fallbackCoords: null,
        url: 'https://news.un.org/feed/subscribe/en/news/topic/economic-development/feed/rss.xml',
        sourceName: 'UN News',
        fundingLabel: UN_NEWS_FUNDING_LABEL,
        attributionUrl: UN_NEWS_ATTRIBUTION_URL,
        maxItems: 4,
    },
]);

// Non-UN RSS feeds whose published Terms of Use explicitly allow non-commercial website headline/RSS display.
// BBC News terms (bbc.co.uk/usingthebbc/terms/can-i-use-bbc-content/) permit non-commercial website RSS with credit + homepage link.
// Held pending owner review: RNZ Pacific (terms prohibit website aggregation), Al Jazeera & France 24 (personal-use only), AllAfrica (allowed with credit, held on owner instruction).
const PUBLIC_NEWS_RSS_FEEDS = Object.freeze([
    {
        id: 'bbc-world-news',
        region: 'Global / Transnational',
        issueHints: ['Security & Diplomacy', 'Governance & Rights', 'Economy & Development'],
        fallbackCoords: null,
        url: 'https://feeds.bbci.co.uk/news/world/rss.xml',
        sourceName: 'BBC News',
        fundingLabel: 'Public broadcaster, UK licence fee',
        attributionUrl: 'https://www.bbc.com/news',
        maxItems: 14,
    },
]);

// Explicit funding & ownership transparency table (never collapse distinct funding models into "independent").
const PUBLISHER_FUNDING_INFO = Object.freeze({
    'news.un.org': {
        sourceName: 'UN News',
        fundingLabel: UN_NEWS_FUNDING_LABEL,
        attributionUrl: UN_NEWS_ATTRIBUTION_URL,
    },
    'un.org': {
        sourceName: 'United Nations',
        fundingLabel: UN_NEWS_FUNDING_LABEL,
        attributionUrl: 'https://www.un.org/en/',
    },
    'reliefweb.int': {
        sourceName: 'ReliefWeb / OCHA',
        fundingLabel: 'UN OCHA humanitarian aggregator',
        attributionUrl: 'https://reliefweb.int/',
    },
    'bbc.com': {
        sourceName: 'BBC News',
        fundingLabel: 'Public broadcaster, UK licence fee',
        attributionUrl: 'https://www.bbc.com/news',
    },
    'bbc.co.uk': {
        sourceName: 'BBC News',
        fundingLabel: 'Public broadcaster, UK licence fee',
        attributionUrl: 'https://www.bbc.com/news',
    },
    'aljazeera.com': {
        sourceName: 'Al Jazeera',
        fundingLabel: 'State-funded, Qatar',
    },
    'france24.com': {
        sourceName: 'France 24',
        fundingLabel: 'State-funded, France',
    },
    'rnz.co.nz': {
        sourceName: 'RNZ',
        fundingLabel: 'Public broadcaster, New Zealand',
    },
    'dw.com': {
        sourceName: 'Deutsche Welle',
        fundingLabel: 'Public broadcaster, Germany',
    },
    'npr.org': {
        sourceName: 'NPR',
        fundingLabel: 'Public radio, listener & grant funded (US)',
    },
    'allafrica.com': {
        sourceName: 'allAfrica',
        fundingLabel: 'African news aggregator (commercial & syndicated)',
        attributionUrl: 'https://allafrica.com',
    },
    'reuters.com': {
        sourceName: 'Reuters',
        fundingLabel: 'Commercial news agency',
    },
    'apnews.com': {
        sourceName: 'Associated Press',
        fundingLabel: 'Nonprofit member-cooperative wire',
    },
    'theguardian.com': {
        sourceName: 'The Guardian',
        fundingLabel: 'Scott Trust / reader & advertising funded',
    },
    'globalvoices.org': {
        sourceName: 'Global Voices',
        fundingLabel: 'Nonprofit volunteer media (CC BY 3.0)',
        attributionUrl: 'https://globalvoices.org/',
    },
    'theconversation.com': {
        sourceName: 'The Conversation',
        fundingLabel: 'Nonprofit academic journalism (CC BY-ND 4.0)',
        attributionUrl: 'https://theconversation.com/',
    },
    'devpolicy.org': {
        sourceName: 'Devpolicy Blog',
        fundingLabel: 'University research blog (ANU, CC BY-NC-SA 4.0)',
        attributionUrl: 'https://devpolicy.org/',
    },
});

// Note: WHO's news-english.xml RSS feed is excluded because its entries are stale (mostly 2020).
const INSTITUTIONAL_RSS_FEEDS = Object.freeze([
    ...UN_NEWS_FEEDS,
]);

const GDELT_FEED_QUERIES = Object.freeze([
    {
        id: 'gdelt-global-politics',
        region: 'Global / Transnational',
        issueHints: ['Security & Diplomacy', 'Governance & Rights', 'Climate & Resources', 'Technology & Information'],
        fallbackCoords: null,
        query: '("Security Council" OR ceasefire OR sanctions OR ASEAN OR "African Union" OR "European Union" OR "South China Sea" OR "climate treaty") sourcelang:english',
        maxrecords: 16,
    },
]);

function getPublisherFundingInfo(domain = '', itemOrFeed = null) {
    if (itemOrFeed?.fundingLabel) {
        return {
            fundingLabel: String(itemOrFeed.fundingLabel).trim(),
            attributionUrl: sanitizeHttpsUrl(itemOrFeed.attributionUrl || ''),
        };
    }
    const cleanDomain = String(domain || '').toLowerCase().replace(/^www\./, '');
    if (!cleanDomain) return null;
    for (const [candidate, info] of Object.entries(PUBLISHER_FUNDING_INFO)) {
        if (cleanDomain === candidate || cleanDomain.endsWith(`.${candidate}`)) {
            return info;
        }
    }
    return null;
}

function truncateSnippet(text = '', maxChars = MAX_SNIPPET_CHARS) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (!clean || clean.length <= maxChars) return clean;
    const sliced = clean.slice(0, maxChars - 1);
    const lastSpace = sliced.lastIndexOf(' ');
    const cut = lastSpace > Math.floor(maxChars * 0.6) ? sliced.slice(0, lastSpace) : sliced;
    return `${cut.replace(/[,:;.\-\s]+$/, '')}…`;
}

function decodeXmlEntities(text = '') {
    return String(text)
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;|&#x27;/gi, "'")
        .replace(/&nbsp;/gi, ' ')
        .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
            const parsed = Number.parseInt(hex, 16);
            return Number.isFinite(parsed) && parsed > 0 && parsed < 0x110000 ? String.fromCodePoint(parsed) : '';
        })
        .replace(/&#(\d+);/g, (_, code) => {
            const parsed = Number.parseInt(code, 10);
            return Number.isFinite(parsed) && parsed > 0 && parsed < 0x110000 ? String.fromCodePoint(parsed) : '';
        })
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();
}

function extractTag(block, tagName) {
    const regex = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, 'i');
    const match = block.match(regex);
    return match ? decodeXmlEntities(match[1]) : '';
}

function sanitizeHttpsUrl(rawUrl) {
    if (typeof rawUrl !== 'string' || !rawUrl.trim()) return null;
    try {
        const parsed = new URL(rawUrl.trim());
        if (parsed.protocol !== 'https:') return null;
        parsed.username = '';
        parsed.password = '';
        return parsed.href;
    } catch {
        return null;
    }
}

function parseValidDateMs(rawDate) {
    const trimmed = String(rawDate || '').trim();
    if (!trimmed) return Number.NaN;
    const ms = Date.parse(trimmed);
    return Number.isFinite(ms) ? ms : Number.NaN;
}

function extractUrlDateBounds(rawUrl) {
    const urlStr = String(rawUrl || '');
    // Full YYYY/MM/DD or YYYY-MM-DD in path
    const ymd = urlStr.match(/(?:^|[/\-_])(20\d{2})[/\-](0?[1-9]|1[0-2])[/\-](0?[1-9]|[12]\d|3[01])(?=$|[/\-_?#.])/);
    if (ymd) {
        const ms = Date.UTC(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
        return { startMs: ms, endMs: ms };
    }
    // DD-MM-YYYY in path (e.g. WHO news URLs like /19-11-2026-...)
    const dmy = urlStr.match(/(?:^|[/\-_])(0?[1-9]|[12]\d|3[01])-(0?[1-9]|1[0-2])-(20\d{2})(?=$|[/\-_?#.])/);
    if (dmy) {
        const ms = Date.UTC(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
        return { startMs: ms, endMs: ms };
    }
    // Year-month /YYYY/MM/ in path (e.g. UN News /2026/11/1200001)
    const ym = urlStr.match(/\/(20\d{2})\/(0?[1-9]|1[0-2])\//);
    if (ym) {
        const year = Number(ym[1]);
        const month = Number(ym[2]) - 1;
        const startMs = Date.UTC(year, month, 1);
        const endMs = Date.UTC(year, month + 1, 0);
        return { startMs, endMs };
    }
    return null;
}

function isFreshAndConsistentDate(rawDate, url, { now = new Date(), maxAgeDays = MAX_ITEM_AGE_DAYS, maxDriftDays = MAX_URL_DATE_DRIFT_DAYS } = {}) {
    const pubMs = parseValidDateMs(rawDate);
    if (!Number.isFinite(pubMs)) return false;
    const nowMs = now instanceof Date ? now.getTime() : Number(now);
    const ageMs = nowMs - pubMs;
    if (ageMs > maxAgeDays * DAY_MS) return false;
    if (ageMs < -2 * DAY_MS) return false; // reject bogus far-future timestamps

    const urlBounds = extractUrlDateBounds(url);
    if (urlBounds) {
        let driftMs = 0;
        if (pubMs < urlBounds.startMs) driftMs = urlBounds.startMs - pubMs;
        else if (pubMs > urlBounds.endMs) driftMs = pubMs - urlBounds.endMs;
        if (driftMs > maxDriftDays * DAY_MS) return false;
    }
    return true;
}

function normalizeFeedDate(rawDate = '') {
    const ms = parseValidDateMs(rawDate);
    if (!Number.isFinite(ms)) return null;
    return new Date(ms).toISOString().slice(0, 10);
}

function parseRssItems(xmlText, {
    sourceName = 'Institutional Feed',
    fundingLabel = '',
    attributionUrl = '',
    maxItems = 5,
    now = new Date(),
    maxAgeDays = MAX_ITEM_AGE_DAYS,
    maxSnippetChars = MAX_SNIPPET_CHARS,
} = {}) {
    if (typeof xmlText !== 'string' || !xmlText.trim()) return [];
    const blocks = xmlText.match(/<item\b[\s\S]*?<\/item>/gi) || [];
    const parsed = [];
    const cleanAttributionUrl = sanitizeHttpsUrl(attributionUrl);
    for (const block of blocks) {
        if (parsed.length >= maxItems) break;
        const title = extractTag(block, 'title');
        const rawLink = extractTag(block, 'link') || extractTag(block, 'guid');
        const link = sanitizeHttpsUrl(rawLink);
        const snippet = truncateSnippet(extractTag(block, 'description'), maxSnippetChars);
        const rawPubDate = extractTag(block, 'pubDate') || extractTag(block, 'dc:date');
        const isoDate = normalizeFeedDate(rawPubDate);
        if (!title || !link || !isoDate) continue;
        if (!isFreshAndConsistentDate(rawPubDate, link, { now, maxAgeDays })) continue;
        parsed.push({
            title,
            snippet,
            link,
            source: sourceName,
            date: isoDate,
            ...(fundingLabel ? { fundingLabel } : {}),
            ...(cleanAttributionUrl ? { attributionUrl: cleanAttributionUrl } : {}),
        });
    }
    return parsed;
}

function formatGdeltSeenDate(seendate = '') {
    const match = String(seendate).match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
    if (!match) return 'Current';
    return `${match[1]}-${match[2]}-${match[3]}`;
}

async function fetchRssFeed(fetchImpl, feedConfig, { now = new Date() } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FREE_FEED_TIMEOUT_MS);
    try {
        const response = await fetchImpl(feedConfig.url, {
            method: 'GET',
            headers: {
                'User-Agent': 'GlobalCommandCenter2026/1.0 (+https://globalcommandcenter2026.netlify.app)',
                Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.1',
            },
            signal: controller.signal,
        });
        if (!response.ok) {
            const err = new Error(`RSS feed ${feedConfig.id} returned HTTP ${response.status}`);
            err.httpStatus = response.status;
            throw err;
        }
        const xml = await response.text();
        return parseRssItems(xml, {
            sourceName: feedConfig.sourceName,
            fundingLabel: feedConfig.fundingLabel,
            attributionUrl: feedConfig.attributionUrl,
            maxItems: feedConfig.maxItems,
            now,
        });
    } finally {
        clearTimeout(timer);
    }
}

async function fetchReliefWebReports(fetchImpl, { appname = '', limit = 15, now = new Date() } = {}) {
    const trimmedAppname = String(appname || '').trim();
    if (!trimmedAppname) {
        return { status: 'skipped-no-appname', items: [] };
    }
    const params = new URLSearchParams();
    params.set('appname', trimmedAppname);
    params.set('limit', String(limit));
    params.set('preset', 'latest');
    for (const field of ['title', 'url', 'date.created', 'primary_country.name', 'source.name', 'theme.name']) {
        params.append('fields[include][]', field);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FREE_FEED_TIMEOUT_MS);
    try {
        const response = await fetchImpl(`${RELIEFWEB_API_V2}?${params.toString()}`, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            signal: controller.signal,
        });
        if (!response.ok) {
            const err = new Error(`ReliefWeb API v2 returned HTTP ${response.status}`);
            err.httpStatus = response.status;
            throw err;
        }
        const payload = await response.json();
        const rows = Array.isArray(payload?.data) ? payload.data : [];
        const items = rows.map(row => {
            const fields = row?.fields || {};
            const link = sanitizeHttpsUrl(fields.url);
            const title = String(fields.title || '').trim();
            const rawDate = fields.date?.created || '';
            const isoDate = normalizeFeedDate(rawDate);
            if (!title || !link || !isoDate) return null;
            if (!isFreshAndConsistentDate(rawDate, link, { now })) return null;
            const country = fields.primary_country?.name || '';
            const source = Array.isArray(fields.source) && fields.source[0]?.name
                ? fields.source[0].name
                : 'ReliefWeb / OCHA';
            const themes = Array.isArray(fields.theme)
                ? fields.theme.map(t => t?.name).filter(Boolean).join(', ')
                : '';
            const snippet = truncateSnippet([country, themes].filter(Boolean).join(' · ') || 'Humanitarian situation report published on ReliefWeb.');
            return {
                title,
                snippet,
                link,
                source,
                date: isoDate,
                fundingLabel: PUBLISHER_FUNDING_INFO['reliefweb.int'].fundingLabel,
                attributionUrl: PUBLISHER_FUNDING_INFO['reliefweb.int'].attributionUrl,
            };
        }).filter(Boolean);
        return { status: 'ok', items };
    } finally {
        clearTimeout(timer);
    }
}

async function fetchGdeltQuery(fetchImpl, queryConfig, { now = new Date() } = {}) {
    const upstreamUrl = `${GDELT_DOC_API}?query=${encodeURIComponent(queryConfig.query)}&mode=ArtList&maxrecords=${queryConfig.maxrecords || 16}&format=json&sort=DateDesc`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GDELT_TIMEOUT_MS);
    try {
        const response = await fetchImpl(upstreamUrl, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            signal: controller.signal,
        });
        if (!response.ok) {
            const err = new Error(`GDELT query ${queryConfig.id} returned HTTP ${response.status}`);
            err.httpStatus = response.status;
            throw err;
        }
        const payload = await response.json();
        const articles = Array.isArray(payload?.articles) ? payload.articles : [];
        return articles.map(article => {
            const link = sanitizeHttpsUrl(article?.url);
            const title = String(article?.title || '').trim();
            const isoDate = formatGdeltSeenDate(article?.seendate);
            if (!title || !link || isoDate === 'Current') return null;
            if (!isFreshAndConsistentDate(isoDate, link, { now })) return null;
            const domain = String(article?.domain || '').toLowerCase().replace(/^www\./, '');
            const fundingInfo = getPublisherFundingInfo(domain);
            return {
                title,
                snippet: truncateSnippet(article?.domain ? `Reported via ${article.domain} (${queryConfig.region}).` : ''),
                link,
                source: fundingInfo?.sourceName || String(article?.domain || 'GDELT'),
                date: isoDate,
                fundingLabel: fundingInfo?.fundingLabel || 'Open news index (GDELT)',
                ...(fundingInfo?.attributionUrl ? { attributionUrl: fundingInfo.attributionUrl } : {}),
            };
        }).filter(Boolean);
    } finally {
        clearTimeout(timer);
    }
}

module.exports = {
    GDELT_DOC_API,
    GDELT_FEED_QUERIES,
    INSTITUTIONAL_RSS_FEEDS,
    MAX_ITEM_AGE_DAYS,
    MAX_SNIPPET_CHARS,
    MAX_URL_DATE_DRIFT_DAYS,
    PUBLIC_NEWS_RSS_FEEDS,
    PUBLISHER_FUNDING_INFO,
    RELIEFWEB_API_V2,
    UN_NEWS_FEEDS,
    decodeXmlEntities,
    extractUrlDateBounds,
    fetchGdeltQuery,
    fetchReliefWebReports,
    fetchRssFeed,
    getPublisherFundingInfo,
    isFreshAndConsistentDate,
    parseRssItems,
    truncateSnippet,
};
