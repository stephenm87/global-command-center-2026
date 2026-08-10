# Changelog

## [Unreleased]
### Added
- Versioned, validated AI intelligence brief responses and contract tests.
- Searchable keyboard-accessible intelligence feed and accessible dialog semantics.
- Provider provenance, freshness, and private-cache metadata.
- A 29-case editorial library: nine original cases plus 20 new cases spanning additional regions and emerging global issues.
- Exactly three core readings for every case, labelled as local, institutional, and independent perspectives, with separate support statements and optional supplemental primary documents.
- Guided Briefings with text search, region and issue filters, result counts, refresh-safe case and step links, review dates, and perspective-labelled readings.
- An **Editorial Cases** globe layer with a visible case count, persistent on/off preference, and multi-location mapping for regional and global cases.
- A documented case-study editorial standard covering claims, sources, sensitivity, map modes, and manual review metadata.
- A searchable Focus Nexus with relationship lenses, source-linked current cases, and actor deep links.
- An anonymous, fixed-query Serper snapshot stored in Netlify Blobs and refreshed every 30 minutes without exposing the provider key.
- Daily automated health classification for editorial source links, plus reusable alternate-source links and an official OCHA PDF fallback for the Myanmar briefing.

### Changed
- Revalidated the Sudan, Guyana–Venezuela, Tuvalu, and Greenland briefings against current primary and independent evidence, and replaced the broken Somaliland source with a reachable local report plus fallback and contested-area context.
- Current provider intelligence now precedes clearly dated editorial context.
- Serper news queries were consolidated and provider calls now have bounded timeouts.
- The Globe.gl/Three.js renderer is loaded on demand, keeping the large rendering engine out of the initial application chunk.
- Firecrawl deep scanning now uses the v2 scrape endpoint.
- The visually dense force graph is now an opt-in Advanced Nexus presentation; the simpler Focus view is the default and preserves actor context when switching presentations.
- Case-study 5W1H and theory panels now use qualified, evidence-aware language instead of generic factual assertions.
- Case records now normalize `coverageRegion`, `featured`, `sensitivity`, `reviewCadenceDays`, `reviewBy`, perspective labels, and point, route, regional, or global map locations for use across the globe, Guided Briefings, and Nexus.
- Feed states now distinguish cached, stale, unavailable, warming, and unconfigured provider data instead of presenting every failure as zero updates.
- Authentication is reserved for visitor-supplied searches, Firecrawl extraction, and AI briefing generation; the fixed public snapshot is anonymously readable.

## [baseline-2026-08-03] - 2026-08-03
### Added
- Initial baseline documentation.
- Project migration files and directory structure.
