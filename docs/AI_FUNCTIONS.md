# AI Functions Integration

The application relies on several AI and data scraping services, orchestrated via Netlify Functions:

1. **Gemini API (`ai-summary.js`)**: Generates contextual summaries of political events. Includes retry logic via `gemini-retry.js`.
2. **Firecrawl (`deep-scan.js`)**: Performs deep web scans for comprehensive intelligence gathering.
3. **Serper & GNews (`fetch-intel.js`, `fetch-news.js`)**: Fetches relevant news articles and search results to populate the intelligence maps and feeds.
