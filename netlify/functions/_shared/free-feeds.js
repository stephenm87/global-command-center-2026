const GDELT_DOC_API = 'https://api.gdeltproject.org/api/v2/doc/doc';
const RELIEFWEB_API_V2 = 'https://api.reliefweb.int/v2/reports';
const FREE_FEED_TIMEOUT_MS = 8000;
const GDELT_TIMEOUT_MS = 6000;

const UN_NEWS_FEEDS = Object.freeze([
    {
        id: 'un-news-africa',
        region: 'Africa',
        issueHints: ['Health & Human Security', 'Security & Diplomacy', 'Governance & Rights'],
        fallbackCoords: [4.8, 21.4],
        url: 'https://news.un.org/feed/subscribe/en/news/region/africa/feed/rss.xml',
        sourceName: 'UN News',
        maxItems: 5,
    },
    {
        id: 'un-news-asia-pacific',
        region: 'Asia-Pacific',
        issueHints: ['Security & Diplomacy', 'Economy & Development', 'Climate & Resources'],
        fallbackCoords: [24.2, 108.0],
        url: 'https://news.un.org/feed/subscribe/en/news/region/asia-pacific/feed/rss.xml',
        sourceName: 'UN News',
        maxItems: 5,
    },
    {
        id: 'un-news-middle-east',
        region: 'Middle East & North Africa',
        issueHints: ['Health & Human Security', 'Security & Diplomacy', 'Governance & Rights'],
        fallbackCoords: [27.5, 38.0],
        url: 'https://news.un.org/feed/subscribe/en/news/region/middle-east/feed/rss.xml',
        sourceName: 'UN News',
        maxItems: 5,
    },
    {
        id: 'un-news-europe',
        region: 'Europe & Eurasia',
        issueHints: ['Security & Diplomacy', 'Governance & Rights', 'Economy & Development'],
        fallbackCoords: [50.8, 28.0],
        url: 'https://news.un.org/feed/subscribe/en/news/region/europe/feed/rss.xml',
        sourceName: 'UN News',
        maxItems: 5,
    },
    {
        id: 'un-news-americas',
        region: 'Americas & Caribbean',
        issueHints: ['Governance & Rights', 'Economy & Development', 'Health & Human Security'],
        fallbackCoords: [7.8, -73.0],
        url: 'https://news.un.org/feed/subscribe/en/news/region/americas/feed/rss.xml',
        sourceName: 'UN News',
        maxItems: 5,
    },
    {
        id: 'un-news-climate',
        region: 'Global / Transnational',
        issueHints: ['Climate & Resources', 'Economy & Development'],
        fallbackCoords: [-13.5, 172.0],
        url: 'https://news.un.org/feed/subscribe/en/news/topic/climate-change/feed/rss.xml',
        sourceName: 'UN News',
        maxItems: 4,
    },
    {
        id: 'un-news-health',
        region: 'Global / Transnational',
        issueHints: ['Health & Human Security', 'Governance & Rights'],
        fallbackCoords: [46.2, 6.1],
        url: 'https://news.un.org/feed/subscribe/en/news/topic/health/feed/rss.xml',
        sourceName: 'UN News',
        maxItems: 4,
    },
    {
        id: 'un-news-human-rights',
        region: 'Global / Transnational',
        issueHints: ['Governance & Rights', 'Health & Human Security'],
        fallbackCoords: [46.2, 6.1],
        url: 'https://news.un.org/feed/subscribe/en/news/topic/human-rights/feed/rss.xml',
        sourceName: 'UN News',
        maxItems: 4,
    },
    {
        id: 'un-news-economic-development',
        region: 'Global / Transnational',
        issueHints: ['Economy & Development', 'Climate & Resources'],
        fallbackCoords: [12.0, -18.0],
        url: 'https://news.un.org/feed/subscribe/en/news/topic/economic-development/feed/rss.xml',
        sourceName: 'UN News',
        maxItems: 4,
    },
]);

const INSTITUTIONAL_RSS_FEEDS = Object.freeze([
    ...UN_NEWS_FEEDS,
    {
        id: 'who-news-english',
        region: 'Global / Transnational',
        issueHints: ['Health & Human Security', 'Governance & Rights'],
        fallbackCoords: [46.23, 6.13],
        url: 'https://www.who.int/rss-feeds/news-english.xml',
        sourceName: 'World Health Organization',
        maxItems: 4,
    },
]);

const GDELT_FEED_QUERIES = Object.freeze([
    {
        id: 'gdelt-global-politics',
        region: 'Global / Transnational',
        issueHints: ['Security & Diplomacy', 'Governance & Rights', 'Climate & Resources', 'Technology & Information'],
        fallbackCoords: [18.0, 12.0],
        query: '(diplomacy OR treaty OR humanitarian OR ceasefire OR sanctions OR "climate finance" OR "AI governance") sourcelang:english',
        maxrecords: 16,
    },
]);

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

function normalizeFeedDate(rawDate = '') {
    const trimmed = String(rawDate || '').trim();
    if (!trimmed) return 'Current';
    const parsed = Date.parse(trimmed);
    if (!Number.isFinite(parsed)) return trimmed;
    return new Date(parsed).toISOString().slice(0, 10);
}

function parseRssItems(xmlText, { sourceName = 'Institutional Feed', maxItems = 5 } = {}) {
    if (typeof xmlText !== 'string' || !xmlText.trim()) return [];
    const blocks = xmlText.match(/<item\b[\s\S]*?<\/item>/gi) || [];
    const parsed = [];
    for (const block of blocks) {
        if (parsed.length >= maxItems) break;
        const title = extractTag(block, 'title');
        const rawLink = extractTag(block, 'link') || extractTag(block, 'guid');
        const link = sanitizeHttpsUrl(rawLink);
        const snippet = extractTag(block, 'description');
        const pubDate = normalizeFeedDate(extractTag(block, 'pubDate'));
        if (!title || !link) continue;
        parsed.push({
            title,
            snippet,
            link,
            source: sourceName,
            date: pubDate,
        });
    }
    return parsed;
}

function formatGdeltSeenDate(seendate = '') {
    const match = String(seendate).match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
    if (!match) return 'Current';
    return `${match[1]}-${match[2]}-${match[3]}`;
}

async function fetchRssFeed(fetchImpl, feedConfig) {
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
            maxItems: feedConfig.maxItems,
        });
    } finally {
        clearTimeout(timer);
    }
}

async function fetchReliefWebReports(fetchImpl, { appname = '', limit = 15 } = {}) {
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
            if (!title || !link) return null;
            const country = fields.primary_country?.name || '';
            const source = Array.isArray(fields.source) && fields.source[0]?.name
                ? fields.source[0].name
                : 'ReliefWeb / OCHA';
            const themes = Array.isArray(fields.theme)
                ? fields.theme.map(t => t?.name).filter(Boolean).join(', ')
                : '';
            const date = typeof fields.date?.created === 'string'
                ? fields.date.created.slice(0, 10)
                : 'Current';
            const snippet = [country, themes].filter(Boolean).join(' · ') || 'Humanitarian situation report published on ReliefWeb.';
            return { title, snippet, link, source, date };
        }).filter(Boolean);
        return { status: 'ok', items };
    } finally {
        clearTimeout(timer);
    }
}

async function fetchGdeltQuery(fetchImpl, queryConfig) {
    const upstreamUrl = `${GDELT_DOC_API}?query=${encodeURIComponent(queryConfig.query)}&mode=ArtList&maxrecords=${queryConfig.maxrecords || 8}&format=json&sort=DateDesc`;
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
            if (!title || !link) return null;
            return {
                title,
                snippet: String(article?.domain ? `Reported via ${article.domain} (${queryConfig.region}).` : ''),
                link,
                source: String(article?.domain || 'GDELT'),
                date: formatGdeltSeenDate(article?.seendate),
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
    RELIEFWEB_API_V2,
    UN_NEWS_FEEDS,
    decodeXmlEntities,
    fetchGdeltQuery,
    fetchReliefWebReports,
    fetchRssFeed,
    parseRssItems,
};
