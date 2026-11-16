# Deployment

The application is deployed on Netlify.

- **Production URL**: https://globalcommandcenter2026.netlify.app
- **Build Command**: `npm run build`
- **Publish Directory**: `dist/`
- **Functions Directory**: `netlify/functions/`

## Continuous Integration
Deployment is automated via Netlify's GitHub integration. Pushes to `main` trigger a production build.

## Scheduled data refresh

- `refresh-public-intel` runs every 30 minutes and stores the anonymous fixed-query Serper snapshot in Netlify Blobs. Each refresh makes eight server-controlled searches, then applies relevance and diversity limits before storing at most 20 items. Review provider usage when changing the query count or refresh schedule.
- `refresh-source-health` runs daily at 03:17 UTC, deduplicates shared URLs, enforces a `24s` scheduled-function deadline (carrying forward prior healthy/restricted status if any slow host exceeds the remaining window), and stores editorial link-availability results.
- Netlify does not automatically execute schedules for deploy previews. From the preview's Functions page, use **Run now** for each scheduled function before validating populated snapshot states.
- `public-intel` can safely warm a missing intelligence snapshot on first read because its queries are fixed and the result is stored and CDN-cached. Source health never runs on a visitor request because it checks many third-party URLs.
- Security headers in `netlify.toml` enforce `script-src 'self'`, `font-src 'self'`, `img-src 'self' data: blob:`, and `connect-src 'self' https://*.supabase.co` (with all fonts, globe textures, country boundaries, and badges self-hosted and GDELT routed through `netlify/functions/gdelt-pulse.mjs`), while `netlify/functions/security.js` emits `Access-Control-Allow-Origin` for production, local loopback, and `deploy-preview-*` origins across both preflight and `200` responses (with `Netlify-Vary: header=Origin` on CDN-cached public endpoints).
- Synchronous functions (`ai-summary.js`, `deep-scan.js`) enforce an internal `21.5s` wall-clock ceiling measured from handler entry; verify in Netlify site settings whether the synchronous function timeout is raised above the `10s` free-tier default (up to `26s` on Pro/configured sites) if retries or slow upstream Firecrawl scrapes are expected.
