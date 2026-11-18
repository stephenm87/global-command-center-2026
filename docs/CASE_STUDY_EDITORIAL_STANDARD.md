# Case Study Editorial Standard

## Purpose and current scope

The case-study library is an educational editorial product, not a live intelligence service. Active regional modules live under `src/cases/active/*.mjs` (`29` baseline active cases across `7` canonical regions) and retired historical snapshots live under `src/cases/archive/archived-2026.mjs`, re-exported through `src/caseStudies2026.js`. Every active case is available as a Guided Briefing, as an Editorial Cases globe item, and as evidence-linked context for the Relations Nexus.

This standard applies whenever a case is added, materially revised, reviewed, or archived.

## Required case record

Each case must provide:

- A permanent kebab-case `id`, lifecycle `status` (`'active'` or `'archived'`), `title`, `subtitle`, canonical `coverageRegion`, `regionTags`, `issueLens`, `broadCategory`, and `issueDimensions`.
- Named `actors` and valid `nexusNodeIds` (`2–4` distinct IDs that exist in `NEXUS_ACTORS`).
- An attributed `statusSummary`, an analytical `whyItMatters`, an ISO `updatedAt` date, `confidence` (`'high'` or `'medium'`), and explicit `uncertainty`.
- An explicit `sensitivity` level (`'standard'` or `'high'`) and `editorialCaution` explaining representation, terminology, privacy, safety, or attribution risks.
- A deliberate boolean `featured` value; this is a curatorial presentation choice, not a quality or importance ranking.
- `reviewCadenceDays` and an explicit ISO `reviewBy` date (`reviewBy === addDays(updatedAt, reviewCadenceDays)`).
- A `map` object with a supported `mode` (`'point'`, `'route'`, `'regional'`, or `'global'`) and at least one valid location.
- Exactly three core `sources` and four or five Guided Briefing `waypoints`.

### Canonical 7-Region & 6-Lens Taxonomy (Option A)

Every case uses one of the **7 canonical `coverageRegion` values**:
- `'Africa'`
- `'Asia-Pacific'`
- `'Middle East & North Africa'`
- `'Europe & Eurasia'` *(including Arctic cases, which retain `'Arctic'` in `regionTags`)*
- `'Americas & Caribbean'` *(North America, Central America, South America, and the Caribbean)*
- `'Pacific Islands'`
- `'Global / Transnational'`

Every case declares both `issueLens` and its corresponding **6-value `broadCategory`** (unified with the Intelligence Feed under Option A):

| `issueLens` (6 Editorial Lenses) | `broadCategory` (`Broad_Category` across Feed, Briefings & Globe) |
|---|---|
| `'Security & Diplomacy'` | `'Geopolitics & Conflict'` |
| `'Governance & Rights'` | `'Governance & Rights'` |
| `'Economy & Development'` | `'Economy & Trade'` |
| `'Climate & Resources'` | `'Environment & Energy'` |
| `'Technology & Information'` | `'Technology & Science'` |
| `'Health & Human Security'` | `'Health & Society'` |

## Three-perspective core reading set

Every case must contain exactly three core readings, with exactly one of each `perspectiveType`:

1. `local`: reporting, research, testimony, or policy analysis rooted in a directly affected country, region, community, or representative regional organization.
2. `institutional`: the relevant treaty text, court record, government, regulator, intergovernmental body, or other institution with formal responsibility.
3. `independent`: credible journalism, peer-reviewed research, or independent civil-society or policy analysis able to scrutinize the other positions.

Each core source must include:

- `title`, `publisher`, and a resolvable HTTPS `url`.
- `publishedAt` when the publication date is known. For a maintained portal or dashboard with no stated publication date, use `sourceType: 'living-reference'`, leave `publishedAt` as `null`, and provide defensible timing metadata such as `reviewedAt`, `dataThrough`, `updatedAt`, or a labelled `milestoneDate`. Never substitute an event date for a page publication date.
- A concise `perspective` description that identifies the source's standpoint or institutional role.
- `supports`, stating only the claims for which that reading is used. Authoring modules may provide this as a string or a list; normalization renders it as display text.

Perspective labels describe source position, not neutrality or reliability. A regional institution may be the best available local perspective for a transnational case, but editors should prefer directly affected voices where safe and feasible. Additional primary records belong in `supplementalSources`; they do not change the three-reading core.

## Claim and attribution rules

- Attribute current status to a named source and date it. Do not turn an organization's claim, legal position, projection, or allegation into an unqualified fact.
- Separate observed status from analysis. `statusSummary` reports what supported sources establish; `whyItMatters` explains the teaching value without forecasting an outcome.
- Preserve material disagreement. State the scope of court decisions, treaties, mandates, and official data rather than implying broader authority or consensus.
- Use precise dates and qualify fast-changing quantities. Recheck casualty, displacement, territorial-control, election, market, and operational figures at review time.
- Describe groups, countries, regions, and communities as internally diverse. Avoid tokenistic “local voice” selection and language that collapses people into their government or an armed actor.
- Do not include private personal data, survivor-identifying details, unsafe community locations, or operational information that could enable harm.

## Guided Briefing waypoints

Each case uses four or five waypoints. Every waypoint must contain:

- A valid `nodeId` from `NEXUS_ACTORS` (which must also appear in `nexusNodeIds`).
- `title`, `perspectiveLabel`, `perspectiveType`, `narration`, and `focusQuestion`.
- Narration traceable to the core readings and a question framed for analysis rather than prediction.

Waypoint `perspectiveType` may be `local`, `institutional`, `independent`, or `synthesis`. Four or five steps do not imply that every disagreement has only that many legitimate positions.

## Map standard

Use the smallest map scope that accurately represents the case:

- `point`: one defensible location for a geographically concentrated case.
- `route`: an ordered set of places connected by a river, corridor, displacement path, supply chain, or other defensible sequence.
- `regional`: multiple relevant locations when political effects, actors, or institutions span a region.
- `global`: multiple representative institutional and affected-community locations for global governance cases.

Each `map.locations` entry requires a `label`, finite `latitude` and `longitude`, and should include a short `role`. A marker indicates relevance to the briefing; it does not assert that the entire issue occurs at that coordinate. Never force a global ocean, climate, health, digital, or treaty case into a misleading single pin.

When a location stands for a state whose claimed capital is internationally contested (for example Jerusalem), label it with the state's name (e.g. `Israel`) and say in `role` which government it represents. Keep the coordinates. Places that are themselves the subject of the case (for example Laayoune, Hargeisa, or Tiraspol) keep their own names.

## Content Depth Standard v2 & C3 Tier 2 Metadata (`briefingVersion: 2`)

Deepened briefings (`briefingVersion: 2`) follow `docs/BRIEFING_VOICE.md` and pair layered study modules with strict source verification:

- **Step narration (`90–160` words):** Every waypoint `narration` splits into **two short paragraphs** separated by `\n\n` (first: what this perspective holds, attributed and dated; second: analytical takeaway connected to `focusQuestion`), plus optional `conceptInFocus` from `['Power', 'Sovereignty', 'Legitimacy', 'Interdependence']`.
- **`background` (`120–200` words):** Opens with a concrete scene, explains key mechanisms in plain English, and cites case sources via `backgroundSources`.
- **`keyTerms` (`3–6` entries):** `{ term, definition, sourceUrl }`, preferring institutional sources and matching a case `source` or `supplementalSource` URL.
- **`debate` (`2–3` entries):** `{ claim, counterClaim, claimBy, counterBy, sourceUrls }` contrasting attributed perspectives with no editorial verdict.
- **`watchFor` (`2–4` entries):** `{ date, indicator, sourceUrl }` citing scheduled events, mandates, or formal reviews (indicators only, never predictions).
- **`examPrompts` (`2` prompts):** Original IB Global Politics Paper 2 analytical questions using syllabus command terms.
- **`influenceCheck` (`3` stages):** `Setting the agenda`, `The formal decision`, and `What changed in practice`, each `{ stage, rating, evidence, sourceUrls }` (`STRONG` | `MIXED` | `WEAK`, displayed as an explicit editorial assessment).
- **`conceptLens`:** Plain-English `1–2`-sentence entries under `{ power, sovereignty, legitimacy, interdependence }`, omitting any concept that does not apply.
- **`essayBuilder`:** `{ prompt, claim, evidence, counterClaim, judgment, sourceUrls }` worked 4-step Paper 2 paragraph answering one `examPrompts` item.
- **C3 Tier 2 fields:** `timeline` (`3–6` `{ date, label, sourceUrl }` events; never using source publish date as event date unless reporting that day's event), `keyFigures` (`0–3` `{ value, unit, label, asOf, sourceUrl }` matching figures in `statusSummary` or `uncertainty`), `concepts` (Unit 1 core four), and `ibThemes` (validated against the 2024/2026 IB Global Politics thematic studies once confirmed by owner).
- **Direct quotes & role check:** Any direct quote must be `<= 25` words, attributed, and linked; all `briefingVersion: 2` map locations must declare non-empty `role`.

## Lifecycle & non-destructive archival (`status: 'active' | 'archived'`)

Because teachers embed `?view=briefings&tour=<case-id>&step=<n>` URLs into syllabi and LMS assignments, superseded or concluded cases must **never** be deleted:

1. Move the record from `src/cases/active/<region>.mjs` to `src/cases/archive/archived-2026.mjs` with `status: 'archived'`, ISO `archivedAt`, `archivedReason`, and optional `supersededById`.
2. Active browse surfaces (Globe Editorial Cases, Intel Feed curated cards, Focus Nexus active counts, and the default Guided Briefings catalog) consume `CASE_STUDIES_2026` (`status === 'active'`), while Guided Briefings deep links and the opt-in archive toggle resolve against `ALL_CASE_STUDIES_2026` (`active + archived`) and display an **Archived Historical Snapshot** banner instead of an overdue alert.

## Review workflow

Before adding or renewing a case:

1. Work on a dedicated feature or fix branch; never edit or commit directly on `main`.
2. Open all three core URLs and confirm the title, publisher, date, HTTPS destination, and claims listed in `supports`.
3. Check for newer local, institutional, and independent evidence, not merely a newer institutional announcement.
4. Re-read the status, uncertainty, sensitivity, map roles, and every waypoint narration for overstatement or changed conditions.
5. Set `updatedAt` to the date through which the status was substantively checked, select a risk-appropriate `reviewCadenceDays`, and set `reviewBy = addDays(updatedAt, reviewCadenceDays)` explicitly.
6. Run `npm run content:staleness`, `npm test`, `npm run build`, and a browser pass through Briefings, the Editorial Cases globe layer, and the linked Nexus actor.

## Discovery behavior & link health

Guided Briefings search indexes case titles, subtitles, region tags, issue dimensions, actors, and source publishers and titles. Region filtering uses `coverageRegion`; issue filtering uses `broadCategory` (the 6-category taxonomy). The globe's **Editorial Cases** toggle controls the separate curated layer and may render more than one marker for a regional or global case.

The application performs a daily reachability check (`refresh-source-health` -> `refresh-source-health-background` when `CRON_SECRET` is configured, with a `36h` staleness safety fallback to the inline `24s` bounded check) for active core, supplemental, and alternate URLs. Archived snapshots (`status: 'archived'`) are excluded from daily link probing so their historical record stays frozen and live link-health badges are omitted; editors should attach durable institutional or repository `alternateUrls` before archiving. Sources and supplemental sources may declare `alternateUrls: [{ label, url }]` pointing to legitimate publisher, institutional, repository, or PDF mirrors. Run `npm run content:staleness` (or `--strict` in scheduled CI) to inspect overdue and upcoming `reviewBy` dates.

## 29-Case Baseline Mapping (`7 Regions × 6 Issue Lenses`)

| # | Case `id` | Module (`src/cases/active/`) | `coverageRegion` | `issueLens` | `broadCategory` |
|---:|---|---|---|---|---|
| 1 | `sudan-displacement-regional-spillover` | `africa-2026.mjs` | `Africa` | `Health & Human Security` | `Health & Society` |
| 2 | `myanmar-fragmented-sovereignty` | `asia-pacific-2026.mjs` | `Asia-Pacific` | `Health & Human Security` | `Health & Society` |
| 3 | `south-china-sea-arbitral-award-ten-years` | `asia-pacific-2026.mjs` | `Asia-Pacific` | `Security & Diplomacy` | `Geopolitics & Conflict` |
| 4 | `syria-transition-return-sanctions` | `mena-2026.mjs` | `Middle East & North Africa` | `Governance & Rights` | `Governance & Rights` |
| 5 | `guyana-venezuela-essequibo-icj` | `americas-caribbean-2026.mjs` | `Americas & Caribbean` | `Security & Diplomacy` | `Geopolitics & Conflict` |
| 6 | `usmca-2026-joint-review` | `americas-caribbean-2026.mjs` | `Americas & Caribbean` | `Economy & Development` | `Economy & Trade` |
| 7 | `tuvalu-australia-falepili-union` | `pacific-islands-2026.mjs` | `Pacific Islands` | `Climate & Resources` | `Environment & Energy` |
| 8 | `greenland-autonomy-security-minerals` | `europe-eurasia-2026.mjs` | `Europe & Eurasia` | `Climate & Resources` | `Environment & Energy` |
| 9 | `eu-ai-act-transparency-implementation` | `europe-eurasia-2026.mjs` | `Europe & Eurasia` | `Technology & Information` | `Technology & Science` |
| 10 | `eastern-drc-peace-civilian-protection` | `africa-2026.mjs` | `Africa` | `Security & Diplomacy` | `Geopolitics & Conflict` |
| 11 | `sahel-after-ecowas-regional-order` | `africa-2026.mjs` | `Africa` | `Security & Diplomacy` | `Geopolitics & Conflict` |
| 12 | `somaliland-recognition-red-sea-order` | `africa-2026.mjs` | `Africa` | `Security & Diplomacy` | `Geopolitics & Conflict` |
| 13 | `zambia-electricity-reset-climate-access` | `africa-2026.mjs` | `Africa` | `Climate & Resources` | `Environment & Energy` |
| 14 | `western-sahara-autonomy-self-determination` | `mena-2026.mjs` | `Middle East & North Africa` | `Security & Diplomacy` | `Geopolitics & Conflict` |
| 15 | `libya-roadmap-elections-oil-assets` | `mena-2026.mjs` | `Middle East & North Africa` | `Governance & Rights` | `Governance & Rights` |
| 16 | `red-sea-yemen-humanitarian-economy` | `mena-2026.mjs` | `Middle East & North Africa` | `Security & Diplomacy` | `Geopolitics & Conflict` |
| 17 | `indus-water-regime-under-strain` | `asia-pacific-2026.mjs` | `Asia-Pacific` | `Security & Diplomacy` | `Geopolitics & Conflict` |
| 18 | `bangladesh-ldc-graduation-decision` | `asia-pacific-2026.mjs` | `Asia-Pacific` | `Economy & Development` | `Economy & Trade` |
| 19 | `kyrgyzstan-tajikistan-border-peace` | `asia-pacific-2026.mjs` | `Asia-Pacific` | `Security & Diplomacy` | `Geopolitics & Conflict` |
| 20 | `mongolia-coal-critical-minerals-transition` | `asia-pacific-2026.mjs` | `Asia-Pacific` | `Climate & Resources` | `Environment & Energy` |
| 21 | `indonesia-nickel-development-bargain` | `asia-pacific-2026.mjs` | `Asia-Pacific` | `Economy & Development` | `Economy & Trade` |
| 22 | `mekong-energy-food-bargain` | `asia-pacific-2026.mjs` | `Asia-Pacific` | `Climate & Resources` | `Environment & Energy` |
| 23 | `pacific-seabed-governance` | `pacific-islands-2026.mjs` | `Pacific Islands` | `Climate & Resources` | `Environment & Energy` |
| 24 | `haiti-security-legitimacy-haitian-ownership` | `americas-caribbean-2026.mjs` | `Americas & Caribbean` | `Governance & Rights` | `Governance & Rights` |
| 25 | `amazon-indigenous-co-governance` | `americas-caribbean-2026.mjs` | `Americas & Caribbean` | `Governance & Rights` | `Governance & Rights` |
| 26 | `rio-bravo-rio-grande-water-treaty` | `americas-caribbean-2026.mjs` | `Americas & Caribbean` | `Climate & Resources` | `Environment & Energy` |
| 27 | `moldova-transnistria-energy-eu-accession` | `europe-eurasia-2026.mjs` | `Europe & Eurasia` | `Climate & Resources` | `Environment & Energy` |
| 28 | `high-seas-bbnj-implementation` | `global-institutions-2026.mjs` | `Global / Transnational` | `Climate & Resources` | `Environment & Energy` |
| 29 | `who-pathogen-access-benefit-sharing` | `global-institutions-2026.mjs` | `Global / Transnational` | `Health & Human Security` | `Health & Society` |
