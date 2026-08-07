# Architecture

The application is a Single Page Application (SPA) built with React and bundled via Vite. It communicates with a serverless backend hosted on Netlify Functions and uses Supabase for authentication and user preferences.

## Frontend
- **Framework**: React 18 bundled with Vite 5, matching the repository toolchain contract
- **Application views**: `src/App.jsx` owns the URL-addressable Live Globe, Guided Briefings, and Advanced Nexus views. Briefing tour/step and Nexus actor selections are encoded in query parameters for refresh-safe links.
- **Visualization**: `Globe.gl` and `Three.js` render the live 3D globe. The default Nexus experience is a DOM/SVG Focus view with search, issue lenses, and a single selected actor. The full force-directed 3D Nexus is an optional secondary presentation.
- **Progressive loading**: The globe, Guided Briefings, Nexus workspace, and advanced 3D Nexus are split into separate chunks. `src/graphReadiness.mjs` prevents force-graph reheating until the 3D graph reports its first engine tick.
- **Case-study projection**: `src/caseStudies2026.js` is the canonical source-aware editorial dataset. `src/nexusTours.js` projects it into guided learning paths, while `src/nexusFocusData.js` combines its dated connections with clearly labelled structural relationship context.
- **Entry Points**: `src/main.jsx` and `src/App.jsx`.

## Backend (Netlify Functions)
Located in `netlify/functions`:
- `ai-summary.js`: Uses Gemini API for text summarization.
- `deep-scan.js`: Uses Firecrawl for deep web scraping.
- `fetch-intel.js`: Aggregates current intel from two broad Serper queries with GNews fallback, adds explicitly dated editorial context after current results, and emits provenance/cache metadata.
- `fetch-news.js`: Retrieves general news.
- `gemini-retry.js`: Utility for handling Gemini API retries.
- `security.js`: Validates Supabase bearer tokens and applies per-user throttling before provider calls.

The frontend uses `src/api.js` to attach the current Supabase access token to every provider-backed request. Static forecast and historical assets remain available without authentication.

Provider calls have explicit deadlines. The feed response uses a short private browser cache plus the existing warm-instance cache. A shared store is still required for safe cross-instance caching and rate limiting; authenticated responses are not placed in a shared CDN cache.

## Data Layer
- **Supabase**: Handles passwordless OTP authentication and stores user cloud preferences.
- **Local state**: `src/localState.mjs` provides exception-safe JSON persistence. Anonymous dashboard and Nexus visualization preferences remain available across refreshes, while signed-in dashboard preferences can additionally synchronize through Supabase.
- **Editorial cases**: Nine dated 2026 records include explicit as-of dates, issue dimensions, uncertainty notes, official or primary source metadata, and map-anchor coordinates. Coordinates are presentation anchors rather than claims about a single event location.
