# Intelligence Feed Coverage Policy

The anonymous intelligence feed is a discovery surface for current global-politics reporting. It is not a claim-verification service and does not replace the three-source editorial review used for case studies.

## Coverage targets

Each refresh searches across seven coverage regions:

1. Africa
2. Asia-Pacific
3. Middle East and North Africa
4. Europe and Eurasia
5. Americas and Caribbean
6. Pacific Islands
7. Global and transnational institutions

The selected snapshot also aims to represent six issue lenses:

1. Security and diplomacy
2. Governance and rights
3. Economy and development
4. Climate and resources
5. Technology and information
6. Health and human security

These are selection lenses, not mutually exclusive labels. A story can engage several issues even though the feed assigns one primary lens for balancing and filtering.

## Selection policy

The server requests seven results from each of eight fixed, English-language Serper queries. It then:

- rejects non-HTTPS records, social-media links, promotional listings, and weak global-politics matches;
- normalizes and deduplicates URLs and headlines;
- assigns a region, issue lens, source role, relevance score, and location precision;
- selects at least one item for every available target region and issue before filling remaining positions by relevance;
- caps the final snapshot at 20 items;
- seeks at least one item from every available mapped source role before filling remaining positions;
- permits no more than four items per region, four per issue, eight per mapped source role, two per publisher domain, two per topic cluster, and four unclassified discovery sources.

Coverage targets are best-effort. If the provider returns no qualifying result for a region or issue, the response reports the gap instead of inserting a weak or fabricated item.

## Source roles

The automated feed uses five transparent source roles:

- **Institutional / primary**: intergovernmental bodies, treaty institutions, and official multilateral sources.
- **Regional / local reporting**: publications based in or focused on an affected region.
- **Independent news**: general-interest news organizations with independent reporting operations.
- **Research / analysis**: research institutes and specialist analytical publications.
- **Additional discovery source**: a relevant result that is not yet mapped to one of the maintained role lists.

Source roles describe format and standpoint. They do not certify neutrality, factual accuracy, safety, or endorsement. Every item retains its original source link so users can inspect the evidence and compare perspectives.

## User-facing provenance

The feed header reports covered regions, covered issues, and represented source roles. Each cached-current card exposes its region, issue, and source role. The detail view explains the automated selection reason and relevance score.

## Known limitations

- Discovery is currently English-language, which can underrepresent reporting published only in other languages.
- Keyword classification can simplify stories that cross several regions or issues.
- Publisher-role lists require maintenance as outlets change ownership, format, or editorial practice.
- Provider ranking affects the candidate pool even though the application applies its own diversity controls afterward.
- Automated relevance and link availability do not verify an article's claims.

Substantive educational case studies therefore continue to require human editorial review, uncertainty language, dated status summaries, and exactly three deliberately selected perspectives.
