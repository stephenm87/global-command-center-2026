# Deployment

The application is deployed on Netlify.

- **Production URL**: https://globalcommandcenter2026.netlify.app
- **Build Command**: `npm run build`
- **Publish Directory**: `dist/`
- **Functions Directory**: `netlify/functions/`

## Continuous Integration
Deployment is automated via Netlify's GitHub integration. Pushes to `main` trigger a production build.

## Scheduled data refresh

- `refresh-public-intel` runs every 6 hours (`0 */6 * * *`) and stores the anonymous fixed-query Serper snapshot in Netlify Blobs. Each refresh makes eight server-controlled searches (`8` queries × `4` runs/day, about `960`/month), then applies relevance and diversity limits before storing at most 20 items; `SNAPSHOT_TTL_MS` matches the 6-hour interval so a snapshot stays `fresh` until `12` hours old (one missed run). Review provider usage when changing the query count or refresh schedule.
- `refresh-source-health` runs daily at 03:17 UTC. When `CRON_SECRET` (`>= 16` chars) is configured in Netlify environment variables alongside Netlify's built-in `URL`, it dispatches to `refresh-source-health-background` (a 15-minute Netlify Background Function using `8000ms` per-URL timeout, `concurrency = 4`, `maxPerHost = 2`, per-host interleaving, and URL deduplication). Because Netlify returns `202` before background code runs, `refresh-source-health` also checks whether the stored snapshot is missing or older than `36` hours and runs the inline `24s` bounded check as a self-healing safety net whenever needed (and `source-health` flags `stale: true` past `36h`). On first deploy with `CRON_SECRET`, trigger **Run now** in a deploy preview and verify `workerMode: "background-15m"` in the snapshot payload.
- Netlify does not automatically execute schedules for deploy previews. From the preview's Functions page, use **Run now** for each scheduled function before validating populated snapshot states.
- `public-intel` can safely warm a missing intelligence snapshot on first read because its queries are fixed and the result is stored and CDN-cached. Source health never runs on a visitor request because it checks many third-party URLs.
- Security headers in `netlify.toml` enforce `script-src 'self'`, `font-src 'self'`, `img-src 'self' data: blob:`, and `connect-src 'self' https://*.supabase.co` (with all fonts, globe textures, country boundaries, and badges self-hosted), while `netlify/functions/security.js` emits `Access-Control-Allow-Origin` for production, local loopback, and `deploy-preview-*` origins across both preflight and `200` responses (with `Netlify-Vary: header=Origin` on CDN-cached public endpoints).
- Paid synchronous functions (`ai-summary.mjs`, `deep-scan.mjs`, `fetch-news.mjs`) enforce an internal `21.5s` wall-clock ceiling on AI/extraction calls measured from handler entry, persist per-user/IP and global UTC daily quotas in deploy-context-isolated Netlify Blobs (`global-command-center-rate-limits`), fail closed (`429` or `503`) before calling external providers, and require `GEMINI_API_KEY`, `FIRECRAWL_API_KEY`, and `SERPER_API_KEY` to be configured as secrets strictly for **Functions only in the Netlify Production deploy context** (legacy `GNEWS_API_KEY` deleted; optional `GOOGLE_NL_API_KEY` is currently unset in Netlify and, if ever added, must also be configured as a **Production-only, Functions-only secret**; Deploy Previews intentionally return `"not configured"`); verify whether Netlify's synchronous function timeout is raised above the `10s` free-tier default (up to `26s` on Pro/configured sites) if retries or slow upstream Firecrawl scrapes are expected.
