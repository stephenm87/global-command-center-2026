# Architecture

The application is a Single Page Application (SPA) built with React and bundled via Vite. It communicates with a serverless backend hosted on Netlify Functions and uses Supabase for authentication and user preferences.

## Frontend
- **Framework**: React 18 bundled with Vite 5, matching the repository toolchain contract
- **Application views & decomposed workspace**: `src/App.jsx` coordinates the URL-addressable Live Globe, Guided Briefings, and Advanced Nexus views while delegating pure URL/clustering/accent helpers to `src/navigationState.mjs`, cloud/local preference hydration to `src/hooks/useSupabasePreferences.js`, lazy WebGL Globe lifecycle and layer synchronization to `src/hooks/useGlobeLayerSync.js`, and focused UI panels to `src/components/IntelSidebar.jsx`, `src/components/OperationalDashboard.jsx`, `src/components/DetailModal.jsx`, `src/components/MineralsModal.jsx`, and `src/components/AppFooter.jsx`. Briefing tour/step and Nexus actor selections are encoded in query parameters for refresh-safe links.
- **Visualization & Nexus modules**: `Globe.gl` and `Three.js` render the live 3D globe (1-tap opt-in on `<768px` mobile viewports, paused whenever hidden). The default Nexus experience is a DOM/SVG Focus view (`src/NexusFocusView.jsx`) with search, issue lenses, and a single selected actor. The optional force-directed 3D Nexus (`src/GlobalRelationsNexus.jsx`) delegates canonical actor IDs (`src/nexus/actorIds.js`), graph anchors/physics/GPC context (`src/nexus/nexusData.js`), Three.js sprite creation/escaped tooltips/scene disposal (`src/nexus/threeSpriteHelpers.js`), HUD filters/controls (`src/nexus/NexusHudControls.jsx`), and node/edge inspection (`src/nexus/NexusInspectorPanel.jsx`).
- **Progressive loading**: The globe, Guided Briefings, Nexus workspace, and advanced 3D Nexus are split into separate chunks. `src/graphReadiness.mjs` prevents force-graph reheating until the 3D graph reports its first engine tick.
- **Case-study projection**: `src/caseStudies2026.js` is the canonical source-aware editorial dataset. `src/nexusTours.js` projects it into guided learning paths, while `src/nexusFocusData.js` combines its dated connections with clearly labelled structural relationship context.
- **Intelligence feed composition**: `src/intelFeed.mjs` merges an anonymous cached provider snapshot, the public linked-reference library, verified editorial cases, and legacy forecasts. Cached current records take precedence over exact duplicates, while distinct insights that share a source remain visible. Public references are always loaded independently and are never relabelled as current.
- **Entry Points**: `src/main.jsx` and `src/App.jsx`.

## Backend (Netlify Functions)
Located in `netlify/functions`:
- `ai-summary.js`: Uses Gemini API (`gemini-3.5-flash-lite` default) for authenticated intelligence summarization.
- `deep-scan.js`: Uses Firecrawl for authenticated article extraction with SSRF/URL normalization guards.
- `public-intel.mjs`: Reads the anonymous fixed-query snapshot (including canonical critical-minerals reference metadata) from Netlify Blobs and uses CDN cache headers. It creates the first snapshot on demand if the scheduled job has not run.
- `refresh-public-intel.mjs`: Rebuilds the public snapshot every 6 hours from fixed editorial queries.
- `fetch-news.js`: Runs authenticated visitor-supplied news searches via Serper.
- `gdelt-pulse.mjs`: Public CDN-cached proxy for allowlisted 3D Nexus GDELT topic pulse queries (`protectPublicEndpoint`).
- `source-health.mjs` and `refresh-source-health.mjs`: Publish and refresh the daily editorial link-health snapshot generated from all case-study sources and declared alternates.
- `gemini-retry.js`: Bounded wall-clock retry helper for Gemini API requests.
- `security.js`: Validates Supabase bearer tokens, origin allowlists, and classroom-safe per-user/IP rate limits before provider calls.

The frontend reads `public-intel` without authentication. It uses `src/api.js` to attach the current Supabase access token only to custom search, Firecrawl, and AI-summary requests. Static forecast, linked-reference, verified-case, and historical assets also remain public. If cached current items are unavailable, the interface identifies the precise state and exposes a direct public-source recovery action instead of rendering an unexplained zero.

Provider calls have explicit deadlines. Netlify Blobs provides cross-instance persistence for public snapshots, and Netlify CDN caching shields free institutional feeds (UN News RSS, WHO RSS, optional ReliefWeb API v2, and best-effort GDELT) and optional Serper queries from visitor traffic. Authenticated custom-search, Firecrawl, and AI responses remain private and are not placed in the shared CDN cache. Durable cross-instance rate limiting for those authenticated endpoints remains separate work.

## Data Layer
- **Supabase**: Handles passwordless OTP authentication and stores user cloud preferences.
- **Local state**: `src/localState.mjs` provides exception-safe JSON persistence. Anonymous dashboard and Nexus visualization preferences remain available across refreshes, while signed-in dashboard preferences can additionally synchronize through Supabase.
- **Editorial cases**: Twenty-nine dated 2026 records include explicit as-of dates, issue dimensions, uncertainty notes, official or primary source metadata, map locations, and optional alternate source URLs. Coordinates are presentation anchors rather than claims about a single event location.
- **Generated source manifest**: `npm run sources:manifest` projects core, supplemental, and alternate case-study URLs into `netlify/functions/source-health-targets.json`. Tests fail when this committed manifest is stale.
