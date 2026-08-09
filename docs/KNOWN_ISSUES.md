# Known Issues

1. **GDELT Reliability**: Upstream GDELT integration has reliability concerns.
2. **Distributed Rate Limiting**: Provider functions now require authentication and apply per-user in-memory limits, but durable cross-instance limits still require a shared store.
3. **Email Verification**: Magic-link email delivery needs verification.
4. **Supabase RLS**: Row Level Security (RLS) policies in Supabase need verification and tightening.
5. **3D Chunk Size**: The application shell is approximately 297 kB before gzip, but the deferred Three.js rendering chunk remains approximately 1.34 MB and should be evaluated on low-end devices.
6. **External Map Assets**: Globe textures and country boundary files still rely on third-party CDNs and should be bundled locally.
7. **Editorial Ownership and Claim Review Automation**: The 29 case studies carry `updatedAt`, `reviewCadenceDays`, `reviewBy`, sensitivity, and uncertainty metadata, and their links receive automated availability checks. The application still does not assign a named editorial owner, open claim-review tasks, send reminders, or verify that claims continue to match source content. A healthy link and displayed review date are not evidence that substantive review occurred; the cases remain dated editorial snapshots rather than a live monitoring service.
8. **Relationship Provenance**: Dated case connections include sources, but the advanced 3D Nexus also contains legacy structural annotations that are reference context rather than independently sourced current claims.
9. **Vite 5 Development Advisories**: The repository contract currently requires Vite 5. `npm audit` reports development-server path/CORS and Windows-path advisories with no fix inside that major. Vite is not included in the Netlify production runtime; local serve and preview are restricted to loopback, but moving to a supported Vite major requires an explicit repository-policy update.

## Recently Resolved

- Public linked-reference records now load independently from protected provider services; unavailable provider-only filters show a clear recovery action instead of a blank feed.
- Deep Scan is available from forecast detail cards and automatically triggers an AI intelligence brief.
- Provider-backed Netlify functions reject unauthenticated callers.
- Production security policy now permits required GDELT and Netlify assets without wildcard function CORS.
- Browser auth supports current Supabase publishable keys and legacy anonymous keys.
- Vite and its React plugin were patched within the repository-required Vite 5 toolchain; the unused local Netlify CLI dependency was removed.
- AI briefs require substantive article content, preserve the article lead and conclusion, and return every versioned field rendered by the interface.
- Dated curated intelligence is labelled as editorial context and follows current provider results instead of being presented as live.
- The intelligence feed is searchable and keyboard-operable, detail dialogs expose dialog semantics, and the 3D engine is loaded on demand.
- Relations Nexus defers force-graph reheating until the renderer signals that its simulation is ready, preventing the previously observed blank-canvas startup failure.
- Anonymous users retain dashboard and Relations Nexus visualization preferences across refreshes. Malformed or unavailable browser storage now falls back safely instead of breaking startup.
- The default Nexus is now a searchable, lens-based Focus view; the visually denser 3D graph is opt-in and loaded only when requested.
- Guided Briefings now expose all 29 regionally balanced cases with text search, region and issue filters, exactly three perspective-labelled core readings per case, and a simpler route from evidence to relationship exploration.
- The globe now has a separate **Editorial Cases** layer, including multi-location regional and global mappings, so curated cases are visibly distinct from provider intelligence.
- Anonymous visitors now receive a durable, CDN-cached fixed-query Serper snapshot; custom searches and Firecrawl remain authenticated.
- Feed status differentiates fresh cache, stale cache, unavailable, warming, and unconfigured provider states.
- Editorial source links receive daily reachability checks, and sources can declare legitimate fallback URLs such as the Myanmar OCHA direct PDF.
