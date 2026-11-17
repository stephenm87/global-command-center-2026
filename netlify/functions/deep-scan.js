// deep-scan.js - Firecrawl-powered article deep extractor
// Called on-demand when a user requests full article content for an Intel card
// POST body: { url: "https://..." }
const dns = require('node:dns').promises;
const net = require('node:net');
const { protectEndpoint } = require('./security');

const MAX_SCRAPE_CONTENT_LENGTH = 15000;
const HANDLER_BUDGET_MS = 21500;
const DNS_PRECHECK_TIMEOUT_MS = 1500;
const DISALLOWED_HOST_SUFFIXES = [
    '.localhost',
    '.local',
    '.internal',
    '.arpa',
    '.nip.io',
    '.sslip.io',
    '.xip.io',
];

function isPrivateIpAddress(rawAddress) {
    if (typeof rawAddress !== 'string' || !rawAddress) return true;
    const normalized = rawAddress.replace(/^\[|\]$/g, '').toLowerCase();
    if (normalized.startsWith('::ffff:')) {
        return isPrivateIpAddress(normalized.slice(7));
    }
    if (normalized.startsWith('::') && normalized.includes('.')) {
        return isPrivateIpAddress(normalized.slice(2));
    }

    const version = net.isIP(normalized);
    if (version === 4) {
        const [a, b, c] = normalized.split('.').map(Number);
        if (a === 0 || a === 10 || a === 127) return true;
        if (a === 169 && b === 254) return true;
        if (a === 172 && b >= 16 && b <= 31) return true;
        if (a === 192 && b === 168) return true;
        if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;
        if (a === 198 && (b === 18 || b === 19)) return true;
        if (a === 198 && b === 51 && c === 100) return true;
        if (a === 203 && b === 0 && c === 113) return true;
        if (a === 100 && b >= 64 && b <= 127) return true;
        if (a >= 224) return true;
        return false;
    }

    if (version === 6) {
        if (normalized === '::' || normalized === '::1') return true;
        if (/^f[cd][0-9a-f]{2}:/.test(normalized)) return true;
        if (/^fe[89ab][0-9a-f]:/.test(normalized)) return true;
        if (normalized.startsWith('64:ff9b:') || normalized.startsWith('2002:')) return true;
        return false;
    }

    return true;
}

function normalizeOutboundUrl(urlStr) {
    if (typeof urlStr !== 'string' || !urlStr.trim() || urlStr.length > 2048) return null;
    try {
        const parsed = new URL(urlStr.trim());
        if (parsed.username || parsed.password) return null;

        if (parsed.protocol === 'http:') {
            if (parsed.port && parsed.port !== '80') return null;
            parsed.protocol = 'https:';
            parsed.port = '';
        } else if (parsed.protocol === 'https:') {
            if (parsed.port && parsed.port !== '443') return null;
            parsed.port = '';
        } else {
            return null;
        }

        const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
        if (!host) return null;
        const bareHost = host.replace(/^\[|\]$/g, '');
        if (net.isIP(bareHost)) {
            return isPrivateIpAddress(bareHost) ? null : parsed.toString();
        }
        if (!host.includes('.')) return null;
        if (host === 'localhost' || DISALLOWED_HOST_SUFFIXES.some(suffix => host.endsWith(suffix))) {
            return null;
        }

        return parsed.toString();
    } catch {
        return null;
    }
}

// ── URL validation & best-effort SSRF pre-check ────────────────────────────
function isValidUrl(urlStr) {
    return Boolean(normalizeOutboundUrl(urlStr));
}

function lookupWithTimeout(host) {
    return Promise.race([
        dns.lookup(host, { all: true }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('DNS lookup timeout')), DNS_PRECHECK_TIMEOUT_MS)),
    ]);
}

async function validateOutboundUrl(urlStr, lookupFn = lookupWithTimeout) {
    const normalizedUrl = normalizeOutboundUrl(urlStr);
    if (!normalizedUrl) return false;
    const parsed = new URL(normalizedUrl);
    const bareHost = parsed.hostname.toLowerCase().replace(/\.$/, '').replace(/^\[|\]$/g, '');
    if (net.isIP(bareHost)) {
        return !isPrivateIpAddress(bareHost);
    }

    try {
        const records = await lookupFn(bareHost);
        const list = Array.isArray(records) ? records : [records];
        if (list.length === 0) return false;
        return list.every(record => record?.address && !isPrivateIpAddress(record.address));
    } catch {
        return false;
    }
}

function selectScrapedMarkdown(markdown) {
    const normalized = typeof markdown === 'string'
        ? markdown.trim().replace(/\n{3,}/g, '\n\n')
        : '';
    if (normalized.length <= MAX_SCRAPE_CONTENT_LENGTH) return normalized;

    const leadLength = Math.floor(MAX_SCRAPE_CONTENT_LENGTH * 0.7);
    const tailLength = MAX_SCRAPE_CONTENT_LENGTH - leadLength;
    return `${normalized.slice(0, leadLength)}\n\n[...middle omitted during extraction...]\n\n${normalized.slice(-tailLength)}`;
}

exports.handler = async (event) => {
    const startedAt = Date.now();
    const security = await protectEndpoint(event, { maxRequests: 15, scope: 'deep-scan' });
    if (security.response) return security.response;

    const headers = security.headers;

    try {
        const { url } = JSON.parse(event.body || '{}');
        if (typeof url !== 'string' || !url.trim()) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'URL required' }) };
        }

        const normalizedUrl = normalizeOutboundUrl(url);
        if (!normalizedUrl || !(await validateOutboundUrl(normalizedUrl))) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid or disallowed URL' }) };
        }

        const firecrawlKey = process.env.FIRECRAWL_API_KEY;
        if (!firecrawlKey) {
            return { statusCode: 503, headers, body: JSON.stringify({ error: 'Firecrawl not configured' }) };
        }

        const remainingMs = Math.max(3000, HANDLER_BUDGET_MS - (Date.now() - startedAt));
        // Scrape the article with Firecrawl within remaining handler wall-clock budget
        const res = await fetch('https://api.firecrawl.dev/v2/scrape', {
            method: 'POST',
            signal: AbortSignal.timeout(remainingMs),
            headers: {
                'Authorization': `Bearer ${firecrawlKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: normalizedUrl,
                formats: ['markdown'],
                onlyMainContent: true,
                timeout: Math.max(2500, Math.min(15000, remainingMs - 1500))
            })
        });

        if (!res.ok) throw new Error(`Firecrawl error: ${res.status}`);
        const data = await res.json();

        const excerpt = selectScrapedMarkdown(data.data?.markdown || '');

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                url: normalizedUrl,
                title: data.data?.metadata?.title || '',
                description: data.data?.metadata?.description || '',
                content: excerpt,
                scrapedAt: new Date().toISOString()
            })
        };

    } catch (error) {
        console.error('[deep-scan] Error:', error.message);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Deep scan failed. Please try again later.' })
        };
    }
};

exports._test = {
    MAX_SCRAPE_CONTENT_LENGTH,
    selectScrapedMarkdown,
    isPrivateIpAddress,
    normalizeOutboundUrl,
    isValidUrl,
    validateOutboundUrl
};
