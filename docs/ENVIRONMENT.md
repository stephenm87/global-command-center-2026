# Environment Variables

The application requires the following environment variables. Do NOT commit the actual `.env` file.

## Client-Side Variables (Exposed to Browser)
- `VITE_GEMINI_API_KEY`: API key for Gemini (if used directly from client, though discouraged).
- `VITE_SERPER_API_KEY`: API key for Serper searches from client.
- `VITE_SUPABASE_URL`: Supabase project URL.
- `VITE_SUPABASE_ANON_KEY`: Supabase anonymous key.

## Server-Side Variables (Netlify Functions Only)
- `GEMINI_API_KEY`: Used by `ai-summary.js` and `fetch-intel.js`.
- `GNEWS_API_KEY`: Used by `fetch-intel.js` and `fetch-news.js`.
- `FIRECRAWL_API_KEY`: Used by `deep-scan.js`.
