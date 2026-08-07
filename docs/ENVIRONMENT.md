# Environment Variables

The application requires the following environment variables. Do NOT commit the actual `.env` file.

## Client-Side Variables (Exposed to Browser)
- `VITE_SUPABASE_URL`: Supabase project URL.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: Supabase publishable key used by the browser client. `VITE_SUPABASE_ANON_KEY` remains supported for legacy projects.

Provider API keys must never use the `VITE_` prefix because Vite exposes those values to browser code.

## Server-Side Variables (Netlify Functions Only)
- `GEMINI_API_KEY`: Used by `ai-summary.js`.
- `GEMINI_SUMMARY_MODEL`: Optional intelligence-brief model override; defaults to `gemini-2.5-flash`. Evaluate any replacement against representative articles before deployment.
- `SERPER_API_KEY`: Used by `fetch-intel.js` and `fetch-news.js`.
- `GNEWS_API_KEY`: Backup news source used by `fetch-intel.js`.
- `GOOGLE_NL_API_KEY`: Optional entity analysis used by `fetch-news.js`.
- `FIRECRAWL_API_KEY`: Used by `deep-scan.js`.
- `SUPABASE_URL`: Supabase project URL used to validate bearer tokens.
- `SUPABASE_PUBLISHABLE_KEY`: Publishable key used by the Supabase Auth user endpoint. `SUPABASE_ANON_KEY` remains supported for legacy projects.
- `ALLOWED_ORIGINS`: Optional comma-separated list of additional preview or custom-domain origins.

All provider-backed functions require a valid Supabase access token. Never configure a Supabase service-role or secret key for this validation path.
