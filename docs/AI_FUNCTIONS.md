# AI Functions Integration

The application relies on several AI and data scraping services, orchestrated via Netlify Functions:

1. **Gemini API (`ai-summary.js`)**: Generates contextual summaries of political events. Includes retry logic via `gemini-retry.js`.
2. **Firecrawl (`deep-scan.js`)**: Performs deep web scans for comprehensive intelligence gathering.
3. **Public Serper snapshot (`public-intel.mjs`, `refresh-public-intel.mjs`)**: Runs four fixed, balanced global-issues queries on the server, stores at most 20 normalized results in Netlify Blobs, and exposes the cached snapshot anonymously. The scheduled refresh runs every 30 minutes in production.
4. **Protected custom search (`fetch-news.js`)**: Accepts a visitor-supplied topic only after Supabase authentication and applies per-user throttling. This is deliberately separate from the public snapshot.
5. **Source health (`refresh-source-health.mjs`, `source-health.mjs`)**: Checks the generated editorial-source manifest daily and publishes non-authoritative availability states (`healthy`, `restricted`, `broken`, or `unknown`) from Netlify Blobs. A health response says whether the checker could reach a URL; it does not validate the article's claims.

Firecrawl is not an anonymous proxy. Article extraction and the downstream AI briefing remain protected because they are expensive, accept visitor-selected URLs, and carry greater abuse and SSRF risk.
