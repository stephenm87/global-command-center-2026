# Case Study Editorial Standard

## Purpose and current scope

The case-study library is an educational editorial product, not a live intelligence service. It currently contains 29 cases: nine original records and 20 additions. Every case is available as a Guided Briefing, as an Editorial Cases globe item, and as evidence-linked context for the Relations Nexus.

This standard applies whenever a case is added, materially revised, or reviewed.

## Required case record

Each case must provide:

- A stable `id`, `title`, `subtitle`, `coverageRegion`, `regionTags`, `broadCategory`, and `issueDimensions`.
- Named `actors` and valid `nexusNodeIds` that exist in `NEXUS_ACTORS`.
- An attributed `statusSummary`, an analytical `whyItMatters`, an ISO `updatedAt` date, `confidence`, and explicit `uncertainty`.
- A normalized `sensitivity` level (`standard` or `high`) and an editorial caution explaining representation, terminology, privacy, safety, or attribution risks. For compatibility, the normalizer currently converts a prose `sensitivity` value into `editorialCaution` and derives the level from review cadence; new edits should prefer an explicit level plus `editorialCaution`.
- A deliberate `featured` value; this is a presentation choice, not a quality or importance ranking.
- `reviewCadenceDays` and an ISO `reviewBy` date.
- A `map` object with a supported `mode` and at least one valid location.
- Exactly three core `sources` and four or five Guided Briefing `waypoints`.

The normalizer retains legacy `coordinates` as a point-map fallback, but new or substantially revised cases should author `map` explicitly.

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

- A valid `nodeId` from `NEXUS_ACTORS`.
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

## Review workflow

Before adding or renewing a case:

1. Work on a dedicated feature or fix branch; never edit or commit directly on `main`.
2. Open all three core URLs and confirm the title, publisher, date, HTTPS destination, and claims listed in `supports`.
3. Check for newer local, institutional, and independent evidence, not merely a newer institutional announcement.
4. Re-read the status, uncertainty, sensitivity, map roles, and every waypoint narration for overstatement or changed conditions.
5. Set `updatedAt` to the date through which the status was substantively checked, select a risk-appropriate `reviewCadenceDays`, and set `reviewBy` explicitly.
6. Run the content-integrity tests, application tests, production build, and a browser pass through Briefings, the Editorial Cases globe layer, and the linked Nexus actor.

Shorter review cadences are appropriate for active conflict, elections, emergencies, negotiations, and volatile operational data. Longer cadences may suit settled legal texts or slower institutional implementation, but no cadence replaces editorial judgment.

## Discovery behavior

Guided Briefings search indexes case titles, subtitles, region tags, issue dimensions, and source publishers and titles. Region filtering uses `coverageRegion`; issue filtering uses `broadCategory`. The globe's **Editorial Cases** toggle controls the separate curated layer and may render more than one marker for a regional or global case.

## Current operational limitation

The application displays review metadata but does not currently assign owners, create review tasks, alert on approaching or overdue dates, check link health, or verify that claims still match their sources. Until that workflow is implemented, an editor must maintain an external review queue and treat every case as a dated snapshot.
