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
- `refresh-source-health` runs daily at 03:17 UTC and stores editorial link-availability results.
- Netlify does not automatically execute schedules for deploy previews. From the preview's Functions page, use **Run now** for each scheduled function before validating populated snapshot states.
- `public-intel` can safely warm a missing intelligence snapshot on first read because its queries are fixed and the result is stored and CDN-cached. Source health never runs on a visitor request because it checks many third-party URLs.
