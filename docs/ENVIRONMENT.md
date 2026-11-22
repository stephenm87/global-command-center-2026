# Environment Variables

The application requires the following environment variables. Do NOT commit the actual `.env` file.

## Client-Side Variables (Exposed to Browser)
- `VITE_SUPABASE_URL`: Supabase project URL.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: Supabase publishable key used by the browser client. `VITE_SUPABASE_ANON_KEY` remains supported for legacy projects.

Provider API keys must never use the `VITE_` prefix because Vite exposes those values to browser code.

## Server-Side Variables (Netlify Functions Only)
Paid API credentials (`GEMINI_API_KEY`, `FIRECRAWL_API_KEY`, `SERPER_API_KEY`, and `GOOGLE_NL_API_KEY`) must be scoped strictly to **Netlify Functions only** in Netlify environment settings — builds must never receive them.

- `GEMINI_API_KEY`: Functions-only secret used by `ai-summary.mjs`.
- `GEMINI_SUMMARY_MODEL`: Optional intelligence-brief model override; defaults to `gemini-3.5-flash-lite` ahead of the `2026-12-01` `gemini-2.5-flash` auto-routing date. Evaluate any replacement against representative articles before deployment.
- `SERPER_API_KEY`: Optional Functions-only key used by authenticated custom search (`fetch-news.mjs`) and, only when `ENABLE_SERPER_PUBLIC_FEED=true`, as an extra source merged into the scheduled public snapshot (`refresh-public-intel`, every 6 hours under `0 */6 * * *` in `netlify.toml`). By default, `refresh-public-intel` runs free institutional & open feeds (UN News regional/topic RSS, BBC World News RSS per non-commercial website RSS terms with publisher credit/link, allAfrica.com Governance/Conflict/External Relations headline-only RSS feeds served as RSS 2.0 XML from `.rdf` endpoints with `allAfrica.com` credit and link, Devpolicy Blog CC BY-NC-SA 4.0 labeled as analysis, Global Voices CC BY 3.0 with author attribution, Mongabay CC BY-ND 4.0 with author attribution and verbatim excerpts, optional ReliefWeb API v2, and a best-effort GDELT Doc API query) with zero `SERPER_API_KEY` required. The key is never returned to anonymous visitors.
- `ENABLE_SERPER_PUBLIC_FEED`: Optional boolean (`"true"` to enable). Defaults to off so scheduled Serper queries stay paused when Serper credits are not funded.
- `RELIEFWEB_APPNAME`: Optional free approved appname for the ReliefWeb API v2 (`https://apidoc.reliefweb.int/parameters#appname`). When set, `refresh-public-intel` includes live ReliefWeb situation reports alongside UN News RSS, BBC World News RSS, allAfrica.com RSS, Devpolicy Blog RSS, Global Voices RSS, Mongabay RSS, and GDELT.
- `GOOGLE_NL_API_KEY`: Optional Functions-only entity analysis key used by `fetch-news.mjs`.
- `FIRECRAWL_API_KEY`: Functions-only key used by `deep-scan.mjs`.
- `AI_SUMMARY_DAILY_CAP`: Optional non-negative integer overriding the global UTC daily request cap across all users for `ai-summary.mjs` (default `200`; `0` disables the endpoint; non-numeric values fail closed with `503`).
- `DEEP_SCAN_DAILY_CAP`: Optional non-negative integer overriding the global UTC daily request cap across all users for `deep-scan.mjs` (default `100`; `0` disables; invalid values fail closed with `503`).
- `FETCH_NEWS_DAILY_CAP`: Optional non-negative integer overriding the global UTC daily request cap across all users for `fetch-news.mjs` (default `300`; `0` disables; invalid values fail closed with `503`).
- `ALLOWED_SIGNIN_EMAILS`: Optional comma-separated, case-insensitive list of verified account emails permitted to invoke authenticated paid endpoints (`ai-summary.mjs`, `deep-scan.mjs`, `fetch-news.mjs`). Checked server-side against the email returned by Supabase `/auth/v1/user`. When both `ALLOWED_SIGNIN_EMAILS` and `ALLOWED_SIGNIN_DOMAINS` are blank/unset, any signed-in account may call the endpoints subject to rate/daily caps.
- `ALLOWED_SIGNIN_DOMAINS`: Optional comma-separated, case-insensitive list of verified exact email domains (leading `@` optional, e.g. `school.edu`) permitted to invoke authenticated paid endpoints.
- `SUPABASE_URL`: Supabase project URL used to validate bearer tokens.
- `SUPABASE_PUBLISHABLE_KEY`: Publishable key used by the Supabase Auth user endpoint. `SUPABASE_ANON_KEY` remains supported for legacy projects.
- `ALLOWED_ORIGINS`: Optional comma-separated list of additional preview or custom-domain origins.
- `CRON_SECRET`: Optional `>= 16`-character shared secret used by the daily `refresh-source-health` scheduler to authenticate `POST` dispatch to `refresh-source-health-background` (Netlify 15-minute Background Function). When unset, `refresh-source-health` automatically falls back to its inline `24s` deadline-bounded check.

The fixed public snapshot and source-health snapshot are anonymously readable, use only server-controlled inputs, and are cached through Netlify. Visitor-supplied searches, Firecrawl scans, and AI summaries require a valid Supabase access token. Never configure a Supabase service-role or secret key for this validation path.

Netlify Blobs is provisioned automatically in deployed Functions; no additional Blob credential is required there. `snapshot-store.mjs` (`global-command-center-snapshots`) and `security.js` (`global-command-center-rate-limits`) both use `getStore()` ONLY in `production` and `getDeployStore()` in Deploy Previews, branch deploys, and non-production environments so preview traffic never overwrites production snapshots or spends production's rate-limit/daily allowance. Paid-function rate limits and daily caps fail closed (`429` when exhausted or `503` if Blobs is unavailable) before calling any external provider. The scheduled functions run only on published production deploys. Use the Netlify Functions UI **Run now** action to populate snapshots for a deploy preview.
