// deep-scan.js - Firecrawl-powered article deep extractor
// Called on-demand when a user requests full article content for an Intel card
// POST body: { url: "https://..." }

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const { url } = JSON.parse(event.body || '{}');
        if (!url) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'URL required' }) };
        }

        const firecrawlKey = process.env.FIRECRAWL_API_KEY;
        if (!firecrawlKey) {
            return { statusCode: 503, headers, body: JSON.stringify({ error: 'Firecrawl not configured' }) };
        }

        // Scrape the article with Firecrawl
        const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
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
            body: JSON.stringify({ error: error.message })
        };
    }
};
