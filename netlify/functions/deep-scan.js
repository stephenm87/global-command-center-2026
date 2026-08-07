// deep-scan.js - Firecrawl-powered article deep extractor
// Called on-demand when a user requests full article content for an Intel card
// POST body: { url: "https://..." }
const { protectEndpoint } = require('./security');

// ── URL validation (SSRF prevention) ───────────────────────────────────────
function isValidUrl(urlStr) {
    try {
        const parsed = new URL(urlStr);
        if (!['http:', 'https:'].includes(parsed.protocol)) return false;
        // Block private/internal IPs
        if (/^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|0\.0\.0\.0|::1|\[::1\])/.test(parsed.hostname)) return false;
        // Block non-FQDN hostnames
        if (!parsed.hostname.includes('.')) return false;
        return true;
    } catch {
        return false;
    }
}

exports.handler = async (event) => {
    const security = await protectEndpoint(event, { maxRequests: 15 });
    if (security.response) return security.response;

    const headers = {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, no-store'
    };

    try {
        const { url } = JSON.parse(event.body || '{}');
        if (!url) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'URL required' }) };
        }

        // Validate URL (SSRF prevention)
        if (!isValidUrl(url)) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid or disallowed URL' }) };
        }

        const firecrawlKey = process.env.FIRECRAWL_API_KEY;
        if (!firecrawlKey) {
            return { statusCode: 503, headers, body: JSON.stringify({ error: 'Firecrawl not configured' }) };
        }

        // Scrape the article with Firecrawl
        const res = await fetch('https://api.firecrawl.dev/v2/scrape', {
            method: 'POST',
            signal: AbortSignal.timeout(20000),
            headers: {
                'Authorization': `Bearer ${firecrawlKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url,
                formats: ['markdown'],
                onlyMainContent: true,
                timeout: 15000
            })
        });

        if (!res.ok) throw new Error(`Firecrawl error: ${res.status}`);
        const data = await res.json();

        const markdown = data.data?.markdown || '';
        // Trim to first 3000 chars to keep response lightweight
        const excerpt = markdown.length > 3000 ? markdown.substring(0, 2997) + '...' : markdown;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                url,
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
