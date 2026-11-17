# Case Study Staleness Audit & 100-Case Expansion Plan (`2026-11`)

**Repository**: `global-command-center-2026`  
**Audit Date**: `2026-11-15`  
**Authored Snapshot Constant (`CONTENT_REVIEW_DATE`)**: `2026-08-10` (`src/caseStudies2026.js:12`, `src/__tests__/contentIntegrity.node.test.mjs:5`)  
**Current Library Size**: 29 curated cases across 4 source files (`src/caseStudies2026.js`, `src/caseStudiesAfricaMena2026.js`, `src/caseStudiesAsiaPacific2026.js`, `src/caseStudiesAmericasGlobal2026.js`) projecting 106 tracked source URLs (`netlify/functions/source-health-targets.json:1-5`).

---

## 1. Executive Findings on Staleness & Source Health

1. **100% Review Overdue (`29 / 29` cases)**: As of `2026-11-15`, every single `reviewBy` date in the library has passed, ranging from **8 days overdue** (`2026-11-07`, `#25 amazon-indigenous-co-governance` and `#28 high-seas-bbnj-implementation`) to **95 days overdue** (`2026-08-12`, `#2 myanmar-fragmented-sovereignty`). Every case renders an overdue warning in the detail modal (`src/App.jsx:60,1925`) and Guided Briefings evidence drawer (`src/GuidedBriefings.jsx:82,324`).
2. **CI Blind Spot on Expiration**: `src/__tests__/contentIntegrity.node.test.mjs:84` asserts `caseStudy.reviewBy >= EDITORIAL_SNAPSHOT_DATE` (`'2026-08-10'`) rather than comparing against wall-clock date or emitting a staleness report, allowing `npm test` to pass indefinitely while 100% of classroom briefings are overdue.
3. **Authored `updatedAt` vs. `reviewBy` Drift**: Cases `#17`–`#29` (`src/caseStudiesAsiaPacific2026.js` and `src/caseStudiesAmericasGlobal2026.js`) set `updatedAt` to the publication date of an underlying event/document (as early as `2025-08-22` on `#25` and `2025-11-27` on `#22`) while computing `reviewBy` from `2026-08-09 + reviewCadenceDays`, contradicting `docs/CASE_STUDY_EDITORIAL_STANDARD.md:79` (*"Set `updatedAt` to the date through which the status was substantively checked"*).
4. **Source Reachability (`netlify/functions/source-health-targets.json` + `netlify/functions/_shared/source-health.js`, raw outputs and runners committed at `docs/audit-evidence/run-source-health.mjs`, `docs/audit-evidence/run-source-health-15s.mjs`, `docs/audit-evidence/source-health-live-2026-11-15.json`, and `docs/audit-evidence/source-health-15s-2026-11-15.json`)**:
   - **Local 3,000 ms Pass (`docs/audit-evidence/source-health-live-2026-11-15.json:4-9`, `concurrency = 16`)**: Running `checkTargets(manifest.targets, { concurrency: 16 })` with `CHECK_TIMEOUT_MS = 3000` (`netlify/functions/_shared/source-health.js:1`) yielded `1 healthy, 2 restricted, 0 broken, 103 unknown` across all `106` tracked targets (likely driven by `3000 ms` cold DNS/TLS/HEAD latency under 16 simultaneous sockets; run a controlled `concurrency = 4` pass or compare against deployed Blobs before tuning).
   - **Verified 15,000 ms Reachability Pass (`docs/audit-evidence/source-health-15s-2026-11-15.json:4-9`, `TIMEOUT_MS = 15000`, `concurrency = 8`, also retrying `Range: bytes=0-0` `GET` on `HEAD 403` and catching `GET` errors in `run-source-health-15s.mjs:40-43` whereas production `source-health.js:33` retries only `405`/`501` — `106` total tracked targets: `69 healthy, 24 restricted, 4 broken, 9 unknown`)**:
     - **87 Core Primary URLs**: **61 `healthy`** (`200`/`202`), **17 `restricted`** (`403` bot/WAF challenge on AP News, Council of the EU, Chatham House, TandF, BMJ, Home Affairs AU, PCA, UNSDG, Stimson, Irrawaddy, Philippines DFA), **2 `broken` (`404`)**, **7 `unknown`** (5 connect/read timeouts + 2 incomplete government TLS certificate chains `UNABLE_TO_VERIFY_LEAF_SIGNATURE`).
     - **3 Core Alternate URLs**: **2 `healthy`** (`#2` OCHA PDF, `#5` ICJ mirror), **1 `broken` (`404`)** (`#12` Horn Tribune print PDF).
     - **16 Supplemental URLs**: **6 `healthy`**, **7 `restricted` (`403`)**, **1 `broken` (`404`)** (`#5` Venezuela MPPRE), **2 `unknown`** (`#3` PRC MFA `ENOTFOUND`, `#7` Australia DFAT timeout).
   - **Critical Case Requiring Immediate Source Replacement**: **`#12 somaliland-recognition-red-sea-order`** (`src/caseStudiesAfricaMena2026.js:226-270`) has **zero `healthy` URLs** across all 5 tracked links: `core:0` (`horntribune.com` article) is `404`, `core:0:alternate:0` (`horntribune.com` PDF) is also `404`, `core:1` (`dppa.dfs.un.org`) times out (`UND_ERR_CONNECT_TIMEOUT`), `core:2` (`apnews.com`) returns `403`, and `supplemental:0` (`theeastafrican.co.ke`) returns `403`.

---

## 2. Complete 29-Case Staleness & URL Reachability Table (as of `2026-11-15`)

Legend for **Core URLs (`[local, institutional, independent]`)**:
- `OK (200)` / `OK (202)`: Reachable (`healthy` via `source-health.js`).
- `403 (WAF)`: HTTP `403` (`restricted` — publisher anti-bot/paywall; often reachable in an interactive browser, but benefits from an `alternateUrls` mirror).
- **`404 BROKEN`**: Confirmed dead link (`broken`) requiring editorial replacement.
- `TLS-ERR`: Node TLS verification failed (`UNABLE_TO_VERIFY_LEAF_SIGNATURE` on government server missing intermediate CA).
- `TIMEOUT`: Origin did not respond within `15s` (`UND_ERR_CONNECT_TIMEOUT` / `ETIMEDOUT`).

| # | Case `id` (`file:line`) | `updatedAt` | `reviewBy` (Cadence) | Days Overdue (`2026-11-15`) | Sensitivity (Raw → Norm) | Core 1 (`local`) | Core 2 (`institutional`) | Core 3 (`independent`) | Alternates / Supplemental Status |
|---:|---|---|---|---:|---|---|---|---|---|
| 1 | `sudan-displacement-regional-spillover` (`caseStudies2026.js:16`) | `2026-08-10` | `2026-08-24` (`14d`) | **83d** | `'high'` → `high` | `TIMEOUT` (Chatham House) | `OK (200)` (UNHCR Data) | `403 (WAF)` (AP News) | Supp: 1 `OK (202)` (UN), 3 `403` (TNH, UNHCR, AP) |
| 2 | `myanmar-fragmented-sovereignty` (`caseStudies2026.js:142`) | `2026-07-13` | `2026-08-12` (`30d` def.) | **95d** | *omitted* → `high` | `403 (WAF)` (Irrawaddy) | `OK (200)` (OCHA Myanmar) | `OK (200)` (OHCHR) | `core:1:alt:0` OCHA PDF `OK (200)` |
| 3 | `south-china-sea-arbitral-award-ten-years` (`caseStudies2026.js:219`) | `2026-07-21` | `2026-08-20` (`30d` def.) | **87d** | *omitted* → `high` | `403 (WAF)` (DFA PH) | `OK (200)` (PCA Award PDF) | `403 (WAF)` (AP News) | Supp: `mfa.gov.cn` `ENOTFOUND` |
| 4 | `syria-transition-return-sanctions` (`caseStudies2026.js:299`) | `2026-06-30` | `2026-09-28` (`90d` def.) | **48d** | *omitted* → `standard` | `OK (200)` (STJ Syria) | `403 (WAF)` (EU Council) | `OK (200)` (Oxford COMPAS) | Supp: UNHCR PDF `403 (WAF)` |
| 5 | `guyana-venezuela-essequibo-icj` (`caseStudies2026.js:379`) | `2026-08-10` | `2026-08-24` (`14d`) | **83d** | `'high'` → `high` | `OK (200)` (CARICOM) | `OK (200)` (ICJ Case 171) | `403 (WAF)` (AP News) | `core:1:alt:0` ICJ mirror `OK (200)`; **Supp `mppre.gob.ve` `404 BROKEN`** |
| 6 | `usmca-2026-joint-review` (`caseStudies2026.js:491`) | `2026-07-23` | `2026-08-22` (`30d` def.) | **85d** | *omitted* → `high` | `OK (200)` (Gob.mx SE) | `OK (200)` (USTR) | `OK (200)` (CSIS) | Supp: Canada GAC `OK (200)` |
| 7 | `tuvalu-australia-falepili-union` (`caseStudies2026.js:571`) | `2026-08-10` | `2026-09-09` (`30d`) | **67d** | `'high'` → `high` | `OK (200)` (DevPolicy) | `403 (WAF)` (Home Affairs AU) | `OK (200)` (VUW Law Rev) | Supp: DFAT `TIMEOUT`; Home Affairs `403` |
| 8 | `greenland-autonomy-security-minerals` (`caseStudies2026.js:690`) | `2026-08-10` | `2026-08-24` (`14d`) | **83d** | `'high'` → `high` | `OK (200)` (KNR) | `OK (200)` (GovMin GL) | `403 (WAF)` (Polar Journal) | Supp: 2 `OK (200)` (Naalakkersuisut), 1 `403` (AP) |
| 9 | `eu-ai-act-transparency-implementation` (`caseStudies2026.js:815`) | `2026-08-03` | `2026-11-01` (`90d` def.) | **14d** | *omitted* → `standard` | `OK (200)` (BEUC) | `OK (200)` (EU Commission) | `OK (200)` (ITPro) | Supp: EUR-Lex `OK (202)`, EC `OK (200)` |
| 10 | `eastern-drc-peace-civilian-protection` (`caseStudiesAfricaMena2026.js:10`) | `2026-08-09` | `2026-08-23` (`14d`) | **84d** | `'high'` → `high` | `OK (200)` (Présidence RDC) | `OK (202)` (UNSC AFC) | `OK (200)` (ISS Africa) | None |
| 11 | `sahel-after-ecowas-regional-order` (`caseStudiesAfricaMena2026.js:104`) | `2026-08-09` | `2026-08-23` (`14d`) | **84d** | `'high'` → `high` | `OK (200)` (ECOWAS) | `OK (200)` (UNOWAS) | `OK (200)` (ISS Africa) | None |
| 12 | `somaliland-recognition-red-sea-order` (`caseStudiesAfricaMena2026.js:197`) | `2026-08-10` | `2026-08-24` (`14d`) | **83d** | `'high'` → `high` | **`404 BROKEN`** (Horn Tribune) | `TIMEOUT` (UN DPPA) | `403 (WAF)` (AP News) | **`core:0:alt:0` PDF `404 BROKEN`**; Supp `403` |
| 13 | `zambia-electricity-reset-climate-access` (`caseStudiesAfricaMena2026.js:307`) | `2026-08-09` | `2026-09-08` (`30d`) | **68d** | `'standard'` → `standard` | `TIMEOUT` (MoE Zambia) | `OK (200)` (Zambezi RA) | `OK (200)` (World Bank) | None |
| 14 | `western-sahara-autonomy-self-determination` (`caseStudiesAfricaMena2026.js:403`) | `2026-08-09` | `2026-09-08` (`30d`) | **68d** | `'high'` → `high` | `OK (200)` (Diplomatie MA) | `OK (202)` (UN Digital Lib) | `OK (200)` (HRW) | None |
| 15 | `libya-roadmap-elections-oil-assets` (`caseStudiesAfricaMena2026.js:496`) | `2026-08-09` | `2026-08-23` (`14d`) | **84d** | `'high'` → `high` | `OK (200)` (Libya Observer) | `OK (202)` (UNSC S/RES/2819) | `403 (WAF)` (Chatham House) | None |
| 16 | `red-sea-yemen-humanitarian-economy` (`caseStudiesAfricaMena2026.js:589`) | `2026-08-09` | `2026-08-16` (`7d`) | **91d** | `'high'` → `high` | `OK (200)` (Sana'a Center) | `OK (200)` (IMO) | `403 (WAF)` (Chatham House) | None |
| 17 | `indus-water-regime-under-strain` (`caseStudiesAsiaPacific2026.js:10`) | `2026-02-09` | `2026-08-23` (`14d`) | **84d** | `'high'` → `high` | `TLS-ERR` (MOFA Pakistan) | `403 (WAF)` (PCA) | `403 (WAF)` (Chatham House) | None (0 `OK` without browser/TLS fix) |
| 18 | `bangladesh-ldc-graduation-decision` (`caseStudiesAsiaPacific2026.js:103`) | `2026-06-02` | `2026-08-23` (`14d`) | **84d** | `'standard'` → `standard` | `TLS-ERR` (SSGP ERD BD) | **`404 BROKEN`** (`un.org/ldcportal/node/858`) | `OK (200)` (CPD BD) | None |
| 19 | `kyrgyzstan-tajikistan-border-peace` (`caseStudiesAsiaPacific2026.js:196`) | `2026-01-19` | `2026-10-08` (`60d`) | **38d** | `'high'` → `high` | `OK (200)` (President KG) | `403 (WAF)` (UNSDG) | `OK (200)` (Carnegie) | None |
| 20 | `mongolia-coal-critical-minerals-transition` (`caseStudiesAsiaPacific2026.js:289`) | `2026-05-11` | `2026-09-23` (`45d`) | **53d** | `'standard'` → `standard` | `TIMEOUT` (`mongolia.gov.mn`) | `OK (200)` (UNDP Mongolia) | `OK (200)` (Think Mongol) | None |
| 21 | `indonesia-nickel-development-bargain` (`caseStudiesAsiaPacific2026.js:382`) | `2026-07-17` | `2026-09-08` (`30d`) | **68d** | `'high'` → `high` | `OK (200)` (BKPM Indonesia) | `OK (200)` (WTO DS592) | `OK (200)` (Lowy Inst.) | None |
| 22 | `mekong-energy-food-bargain` (`caseStudiesAsiaPacific2026.js:475`) | `2025-11-27` | `2026-09-23` (`45d`) | **53d** | `'standard'` → `standard` | `OK (200)` (MAE Viet Nam) | `OK (200)` (MRC Mekong) | `403 (WAF)` (Stimson) | None |
| 23 | `pacific-seabed-governance` (`caseStudiesAsiaPacific2026.js:568`) | `2026-07-24` | `2026-08-23` (`14d`) | **84d** | `'high'` → `high` | `OK (200)` (Gov. Nauru) | `OK (200)` (ISA Council) | `OK (200)` (Nature) | None |
| 24 | `haiti-security-legitimacy-haitian-ownership` (`caseStudiesAmericasGlobal2026.js:8`) | `2026-06-12` | `2026-09-08` (`30d`) | **68d** | *prose (`L22`)* → `high` | `TIMEOUT` (RNDDH PDF) | `OK (202)` (UN SG Briefing) | `OK (200)` (HRW) | None |
| 25 | `amazon-indigenous-co-governance` (`caseStudiesAmericasGlobal2026.js:110`) | `2025-08-22` | `2026-11-07` (`90d`) | **8d** | *prose (`L124`)* → `standard` | `OK (200)` (COICA) | `OK (200)` (OTCA Bogotá PDF) | `OK (200)` (WRI Brasil) | None |
| 26 | `rio-bravo-rio-grande-water-treaty` (`caseStudiesAmericasGlobal2026.js:214`) | `2026-02-03` | `2026-09-08` (`30d`) | **68d** | *prose (`L228`)* → `high` | `OK (200)` (CONAGUA MX) | `OK (200)` (IBWC Minute 331) | `OK (200)` (Texas Tribune) | None |
| 27 | `moldova-transnistria-energy-eu-accession` (`caseStudiesAmericasGlobal2026.js:316`) | `2026-07-14` | `2026-09-23` (`45d`) | **53d** | *prose (`L330`)* → `standard` | `OK (200)` (Promo-LEX) | `403 (WAF)` (EU Council) | `OK (200)` (ECFR) | None |
| 28 | `high-seas-bbnj-implementation` (`caseStudiesAmericasGlobal2026.js:418`) | `2026-04-06` | `2026-11-07` (`90d`) | **8d** | *prose (`L432`)* → `standard` | `OK (200)` (PSIDS UN PDF) | `OK (200)` (UN DOALOS BBNJ) | `OK (200)` (IISD ENB PDF) | None |
| 29 | `who-pathogen-access-benefit-sharing` (`caseStudiesAmericasGlobal2026.js:523`) | `2026-07-20` | `2026-09-08` (`30d`) | **68d** | *prose (`L537`)* → `high` | `OK (200)` (African Union PDF) | `OK (200)` (WHO) | `403 (WAF)` (The BMJ) | None |

---

## 3. Pipeline Design for ~100 New Recent Case Studies

### 3.1 Canonical Case Record Template (`docs/CASE_STUDY_EDITORIAL_STANDARD.md` Compliant)

Every new case must author **explicit** normalized fields rather than relying on legacy fallbacks in `normalizeCaseStudy` (`src/caseStudies2026.js:951-999`):
- Do **not** omit `coverageRegion`, `sensitivity`, `editorialCaution`, `featured`, `reviewCadenceDays`, `reviewBy`, or `map`.
- Do **not** pass prose inside `sensitivity` (legacy compat in `src/caseStudiesAmericasGlobal2026.js:22,124,228,330,432,537`); set `sensitivity: 'standard' | 'high'` and `editorialCaution: '<explicit guidance>'`.
- Set `updatedAt` strictly to the ISO date (`YYYY-MM-DD`) on which human substantive verification was completed (`docs/CASE_STUDY_EDITORIAL_STANDARD.md:79`), and set `reviewBy = addDays(updatedAt, reviewCadenceDays)` explicitly.
- Declare at least one legitimate institutional/repository `alternateUrls` entry whenever a primary URL belongs to a known WAF-403 or slow/unstable government domain (`apnews.com`, `chathamhouse.org`, `consilium.europa.eu`, ministry portals with incomplete TLS chains).

```js
/**
 * Canonical Case Study Template (v2 — 100-Case Expansion Pipeline)
 * Satisfies docs/CASE_STUDY_EDITORIAL_STANDARD.md and src/__tests__/contentIntegrity.node.test.mjs
 */
export const CASE_TEMPLATE = {
    // 1. Identity & Discovery Taxonomy
    id: 'kebab-case-region-topic-slug', // /^[a-z0-9]+(?:-[a-z0-9]+)*$/ — permanent deep-link key (?tour=<id>)
    status: 'active',                   // 'active' | 'archived' (new lifecycle field; see Section 4)
    title: 'Place or Institution: Concise Analytical Tension',
    subtitle: 'One-line framing of the governance, power, rights, or resource question',

    // Must match one of the 7 canonical regions (see Section 3.2):
    // 'Africa' | 'Asia-Pacific' | 'Middle East & North Africa' | 'Europe & Eurasia' |
    // 'Americas & Caribbean' | 'Pacific Islands' | 'Global / Transnational'
    coverageRegion: 'Africa',
    regionTags: ['Africa', 'Subregion Name', 'Country or Basin Name'],

    // Primary issue lens aligned with the 6 intel-feed lenses (see Section 3.2):
    // 'Security & Diplomacy' | 'Governance & Rights' | 'Economy & Development' |
    // 'Climate & Resources' | 'Technology & Information' | 'Health & Human Security'
    issueLens: 'Governance & Rights',
    // Backward-compatible Broad_Category (either unified 6-value enum or mapped 5-value enum; see Decision Gate)
    broadCategory: 'Governance & Rights',
    issueDimensions: ['Specific dimension 1', 'Specific dimension 2', 'Specific dimension 3', 'Specific dimension 4'],

    // 2. Actors & Nexus Graph Linkage
    actors: [
        'Named state or ministry',
        'Named multilateral or judicial body',
        'Named affected local constituency or civil-society group',
    ],
    // 2–4 distinct IDs strictly from NEXUS_ACTORS (src/nexusFocusData.js:4-22):
    // ['USA','China','Russia','Europe','MiddleEast','Africa','AsiaPacific','LatinAmerica',
    //  'NATO','UN_OPEC','BiotechHub','TechAIHub','MilitantPMC','Jihadist','Cartels','CyberActors','Hezbollah']
    // NOTE: nexusNodeIds[0] serves as the primary anchor for synthesized Focus Nexus edges (nexusFocusData.js:116).
    nexusNodeIds: ['Africa', 'UN_OPEC', 'TechAIHub'],

    // 3. Substantive Claims, Epistemic Framing & Review Cadence
    statusSummary: '2–4 attributed sentences stating only what the three attached sources establish as of updatedAt, including exact cutoff dates for operational figures.',
    whyItMatters: '2–3 analytical sentences connecting the case to IB Global Politics concepts (power, sovereignty, legitimacy, interdependence, human rights, development, peace and conflict) without predictive hype.',
    updatedAt: '2026-11-20',          // Exact ISO date substantive verification was completed
    confidence: 'high',               // 'high' | 'medium'
    uncertainty: 'Explicit statement of what remains contested, unverified, under negotiation, or subject to reporting restrictions.',
    sensitivity: 'high',              // 'standard' | 'high'
    editorialCaution: 'Specific representation, terminology, legal-status, survivor-dignity, or non-monolithic attribution guidance for teachers and students.',
    featured: false,                  // Deliberate curatorial flag (keep featured <= 15–20% of active library)
    reviewCadenceDays: 30,            // 7–14d active conflict/emergency; 30–45d active diplomacy/policy; 60–90d treaty/regulatory implementation
    reviewBy: '2026-12-20',           // Explicit ISO date >= updatedAt

    // 4. Explicit Spatial Framing
    // mode: 'point' (1 loc) | 'regional' (2–5 locs) | 'route' (2–5 ordered corridor locs) | 'global' (2–5 institutional/affected locs)
    map: {
        mode: 'regional',
        locations: [
            { label: 'Primary City / Site', latitude: 0.0, longitude: 0.0, role: 'Local governance and affected community site' },
            { label: 'Treaty / Regional Seat', latitude: 0.0, longitude: 0.0, role: 'Diplomatic or judicial decision venue' },
        ],
    },

    // 5. Three-Perspective Core Reading Set (EXACTLY 3: 1 'local', 1 'institutional', 1 'independent')
    sources: [
        {
            title: 'Exact document or article title',
            publisher: 'Named domestic/regional/affected-constituency publisher',
            publishedAt: '2026-10-14', // ISO YYYY-MM-DD (or null ONLY if sourceType === 'living-reference')
            url: 'https://example.org/local-primary-source',
            perspectiveType: 'local',
            perspective: 'Whose proximate standpoint this source represents (never treat one actor as speaking for an entire population)',
            supports: 'Specific factual or interpretive claim in statusSummary/waypoints anchored by this source',
            alternateUrls: [
                { label: 'Official PDF / institutional repository mirror', url: 'https://archive-or-mirror.example.org/doc.pdf' },
            ],
        },
        {
            title: 'Official resolution, court docket, treaty text, or operational portal',
            publisher: 'Named intergovernmental, judicial, or statutory authority',
            publishedAt: null,
            sourceType: 'living-reference',
            reviewedAt: '2026-11-20',
            milestoneDate: '2026-09-30',
            milestoneLabel: 'Mandate renewal / filing cutoff',
            url: 'https://example.int/official-record',
            perspectiveType: 'institutional',
            perspective: 'Formal legal mandate, procedural posture, or official operational dataset',
            supports: 'Legal framework, dates, or baseline metrics cited in the briefing',
        },
        {
            title: 'Independent research paper or investigative analysis',
            publisher: 'Named university center, specialist institute, or independent newsroom',
            publishedAt: '2026-11-02',
            url: 'https://example.edu/independent-analysis',
            perspectiveType: 'independent',
            perspective: 'External empirical or legal assessment not controlled by the primary disputants',
            supports: 'Implementation trade-offs, structural critique, or cross-case comparison',
        },
    ],

    // Optional: 0–3 supplemental sources (each https:// with valid publishedAt or living-reference metadata)
    supplementalSources: [],

    // 6. Guided Briefing Waypoints (4 or 5 steps; every nodeId MUST appear in nexusNodeIds)
    waypoints: [
        {
            nodeId: 'Africa',
            title: 'Step 1: Local Stakes and Lived Context',
            perspectiveLabel: 'Named local actor / reporting source',
            perspectiveType: 'local', // 'local' | 'institutional' | 'independent' | 'synthesis'
            narration: '2–3 attributed sentences grounding the issue in proximate stakes.',
            focusQuestion: 'Open-ended IB inquiry question testing power, legitimacy, or rights?',
        },
        {
            nodeId: 'UN_OPEC',
            title: 'Step 2: Institutional Mandate and Legal Rules',
            perspectiveLabel: 'Named treaty body / court / ministry',
            perspectiveType: 'institutional',
            narration: '2–3 attributed sentences explaining formal rules, jurisdiction, and constraints.',
            focusQuestion: 'Open-ended IB inquiry question on institutional authority vs. state sovereignty?',
        },
        {
            nodeId: 'TechAIHub',
            title: 'Step 3: Transnational Leverage and Structural Trade-Offs',
            perspectiveLabel: 'Named independent research organization',
            perspectiveType: 'independent',
            narration: '2–3 attributed sentences examining supply chains, finance, or external leverage.',
            focusQuestion: 'Open-ended IB inquiry question on structural interdependence?',
        },
        {
            nodeId: 'Africa',
            title: 'Step 4: Competing Standards of Success',
            perspectiveLabel: 'Cross-source synthesis',
            perspectiveType: 'synthesis',
            narration: '2–3 sentences contrasting how local, institutional, and external actors define a legitimate outcome.',
            focusQuestion: 'Comparative evaluation prompt suitable for seminar discussion or written response?',
        },
    ],
};
```

---

### 3.2 Regional & Issue-Lens Quota Matrix (100 New Cases → 129 Combined Portfolio)

#### Resolving the Current Taxonomy Split
Today, the intelligence feed (`netlify/functions/_shared/intel-snapshot.js:13-30`) and `docs/INTELLIGENCE_FEED_COVERAGE.md:7-24` balance across **7 regions × 6 issue lenses** (42 cells), whereas `src/caseStudies2026.js:909-935` normalizes curated cases into **9 regions × 5 `BROAD_CATEGORIES`** (omitting `'Governance & Rights'` completely and splitting `'Europe'`/`'Arctic'` and `'Latin America & Caribbean'`/`'North America'`). As a result, **24 of the 42 region × lens cells currently contain `0` cases**, `Technology & Information` has only **1** case (`#9` EU AI Act), `Pacific Islands` and `Global / Transnational` have only **2** cases each, and `CyberActors` (`src/nexusFocusData.js:20`) has **0** cases.

To keep the 100 new cases balanced across all **7 regions** and **6 issue lenses**, we enforce:
1. **Cell Floor**: Every single one of the 42 `(region × issueLens)` cells receives **at least 2 new cases** (`42 × 2 = 84` baseline slots), with the remaining 16 slots allocated to counterbalance under-represented lenses (`Technology & Information`, `Health & Human Security`, `Economy & Development`, `Governance & Rights`) and expand thin regions (`Europe & Eurasia` `+16`, `Global / Transnational` `+14`, `Pacific Islands` `+13` from `2` to `15`).
2. **Region Range**: Every region receives **13–16 new cases**, bringing every region in the 129-case combined library to **15–21 cases** (within `-3.4 / +2.6` of the `18.4` mean).
3. **Lens Range**: Every lens receives **14–19 new cases**, bringing every lens in the 129-case combined library to **20–23 cases** (within ±1.5 of the 21.5 mean, compared to `1–9` across the 6 substantive lenses today, or `1–14` across the legacy 5-category `Broad_Category` taxonomy).

#### Quota Table: Existing 29 *(by substantive 6-lens classification)* + **100 New Cases** = 129 Total

Cells show **`+New` (`Existing → Combined Total`)**:

| Coverage Region (7 Canonical) | Security & Diplomacy | Governance & Rights | Economy & Development | Climate & Resources | Technology & Information | Health & Human Security | **New Cases Subtotal** | **Combined Total (`29 + 100`)** |
|---|---|---|---|---|---|---|---|---|
| **1. Africa** | **+2** (`3 → 5`) | **+3** (`0 → 3`) | **+3** (`0 → 3`) | **+2** (`1 → 3`) | **+3** (`0 → 3`) | **+2** (`1 → 3`) | **+15** | **20** |
| **2. Asia-Pacific** | **+2** (`3 → 5`) | **+2** (`0 → 2`) | **+2** (`2 → 4`) | **+2** (`2 → 4`) | **+3** (`0 → 3`) | **+2** (`1 → 3`) | **+13** | **21** |
| **3. Middle East & North Africa** | **+2** (`2 → 4`) | **+2** (`2 → 4`) | **+3** (`0 → 3`) | **+2** (`0 → 2`) | **+3** (`0 → 3`) | **+3** (`0 → 3`) | **+15** | **19** |
| **4. Europe & Eurasia** *(incl. Arctic)* | **+2** (`0 → 2`) | **+3** (`0 → 3`) | **+3** (`0 → 3`) | **+2** (`2 → 4`) | **+3** (`1 → 4`) | **+3** (`0 → 3`) | **+16** | **19** |
| **5. Americas & Caribbean** *(NA + LAC)* | **+2** (`1 → 3`) | **+2** (`2 → 4`) | **+2** (`1 → 3`) | **+2** (`1 → 3`) | **+3** (`0 → 3`) | **+3** (`0 → 3`) | **+14** | **19** |
| **6. Pacific Islands** | **+2** (`0 → 2`) | **+2** (`0 → 2`) | **+2** (`0 → 2`) | **+2** (`2 → 4`) | **+2** (`0 → 2`) | **+3** (`0 → 3`) | **+13** | **15** |
| **7. Global / Transnational** | **+2** (`0 → 2`) | **+3** (`0 → 3`) | **+3** (`0 → 3`) | **+2** (`1 → 3`) | **+2** (`0 → 2`) | **+2** (`1 → 3`) | **+14** | **16** |
| **New Cases by Lens** | **+14** | **+17** | **+18** | **+14** | **+19** | **+18** | **+100** | — |
| **Combined Total (`29 + 100`)** | **23** | **21** | **21** | **23** | **20** | **21** | — | **129** |

#### Mandatory `NEXUS_ACTORS` Node Quotas Across the 100 New Cases
To ensure no actor in `src/nexusFocusData.js:4-22` is orphaned or thin in `NexusFocusView`:
- **`CyberActors`** (`0` today): **>= 8 new cases** (including >= 3 as primary anchor `nexusNodeIds[0]`, e.g., subsea cable resilience, sovereign cloud/ransomware against public hospitals, election information-integrity infrastructure).
- **Single-case actors today (`NATO`, `Jihadist`, `Cartels`, `Hezbollah`)**: **>= 4 new cases each** (`>= 5` total each).
- **Low-count actors today (`BiotechHub` [2], `USA` [3], `Russia` [3], `MiddleEast` [3], `MilitantPMC` [3], `China` [4])**: **>= 5 new cases each**.
- **`UN_OPEC` cap**: Currently attached to `25 / 29` (`86%`) of cases; cap `UN_OPEC` at **<= 50%** of new cases so bilateral, subnational, corporate, and regional-bloc dynamics do not hub-spoke everything through `UN_OPEC`.

---

### 3.3 File Layout, Bundle-Size Protection & Test / Source-Health Scaling

#### A. File Layout: Split by Canonical Region + Year AND Separate Lightweight Index from Full Case Bodies
Do **not** keep appending 100 cases (~10,000+ lines of JS objects) to the existing 4 regional files:
1. **Maintainability**: Each of the 4 existing files is already 620–1,065 lines; adding 100 cases (~3,400–4,000 lines per file if kept in 4 files) causes merge conflicts during batch authoring and opaque diffs.
2. **Initial Bundle Bloat**: Today, `src/App.jsx:10,27` statically imports `CASE_STUDIES_2026`, baking all 29 cases (~115 kB raw text) into the synchronous main entry chunk `dist/assets/index-*.js` (**`439.74 kB` raw / `137.82 kB` gzip**). Adding 100 full cases with 4–5 waypoints and 3–5 annotated sources each would add **~380–450 kB of raw JS** to the initial entry chunk (~850 kB raw), directly penalizing initial Globe load when only card summaries + coordinates are needed up front.

**Recommended Directory Layout (`src/cases/`)**:
```text
src/
├── caseStudies2026.js                  # Public facade + normalizer + toForecastRecord (preserves existing imports)
└── cases/
    ├── schema.mjs                      # Shared constants: REGIONS_7, ISSUE_LENSES_6, BROAD_CATEGORIES, normalizeCaseStudy()
    ├── active/
    │   ├── africa-2026.mjs             # Existing #1, #10-#13 + 15 new Africa cases (~20 cases)
    │   ├── asia-pacific-2026.mjs       # Existing #2-#3, #17-#22 + 13 new Asia-Pacific cases (~21 cases)
    │   ├── mena-2026.mjs               # Existing #4, #14-#16 + 15 new MENA cases (~19 cases)
    │   ├── europe-eurasia-2026.mjs     # Existing #8-#9, #27 + 16 new Europe/Eurasia/Arctic cases (~19 cases)
    │   ├── americas-caribbean-2026.mjs # Existing #5-#6, #24-#26 + 14 new Americas/Caribbean cases (~19 cases)
    │   ├── pacific-islands-2026.mjs    # Existing #7, #23 + 13 new Pacific Islands cases (~15 cases)
    │   └── global-institutions-2026.mjs# Existing #28-#29 + 14 new Global/Transnational cases (~16 cases)
    └── archive/
        └── archived-2026.mjs           # Retired snapshots preserved for deep links & longitudinal comparison
```
- **Why `.mjs` in `src/cases/`**: Using native `.mjs` with explicit relative extensions (`./schema.mjs`) eliminates the fragile temp-dir regex rewrite hack in `scripts/generate-source-health-manifest.mjs:16-32` — both Vite and Node 22 (`node --test` and `scripts/generate-source-health-manifest.mjs`) can `import` `src/cases/` directly without temporary file copying!
- **Vite Chunking (`vite.config.mjs`)**: Add a `manualChunks` rule grouping `src/cases/` into a dedicated `case-studies` chunk (or lazy-load `waypoints` + `supplementalSources` when opening `GuidedBriefings` / `selectedDetail`), keeping `index-*.js` lean while caching editorial content independently of UI code changes.

#### B. Scaling `netlify/functions/refresh-source-health.mjs` Beyond the 30s Cliff
- **Problem**: At 129 cases (~430–480 source URLs), `checkTargets` at `concurrency = 24` (`netlify/functions/_shared/source-health.js:54`) runs 18–20 sequential waves. Because `405`/`501` `HEAD` responses trigger a second `GET` (`Range: bytes=0-0`) and slow UN/ministry origins take 3–8 seconds on cold TLS, total wall time reaches **45–90+ seconds** — exceeding **Netlify Scheduled Functions' hard 30-second execution limit** (`netlify.toml:9-10`) and terminating before `writeSnapshot` runs.
- **Required Pipeline Upgrade (3 parts)**:
  1. **Deduplicate URLs before checking**: Multiple cases can cite the same treaty portal or docket (`un.org/bbnjagreement/en`, `icj-cij.org`, `data.unhcr.org`), and `src/sourceHealth.mjs:3` already indexes client lookup by `item.url`. Deduplicating unique URLs before `checkTargets` and fanning results back to target IDs cuts redundant sockets immediately.
  2. **Convert worker to a Netlify Background Function (`refresh-source-health-background.mjs`, 15-minute limit)**: Keep `refresh-source-health.mjs` as a 1-second daily cron dispatcher that invokes `refresh-source-health-background` (authenticated via an internal `CRON_SECRET` header), giving the link checker up to 15 minutes.
  3. **Raise `CHECK_TIMEOUT_MS` from `3000` to `8000` ms (`source-health.js:1`) with `concurrency = 32` and per-host concurrency cap (`<= 2` concurrent requests per hostname)**: Eliminates the cold-TLS false-timeout storm we observed across all `106` tracked targets (`103/106` timeouts at `3000ms` vs `69` healthy + `24` `403` + `4` `404` + `9` `unknown` at `15000ms`) and avoids tripping publisher WAF rate limits when multiple cases cite `un.org`, `apnews.com`, or `chathamhouse.org`.

#### C. Growing `src/__tests__/contentIntegrity.node.test.mjs` for 129+ Cases
Replace brittle point-in-time constants with structural, quota, and lifecycle invariants:
1. **Remove Hardcoded `29` Counts (`L46`, `L176`)**: Assert `CASE_STUDIES_2026.length >= 29` during batch rollout (or match ` EXPECTED_BATCH_FLOOR` per milestone) and keep `assert.equal(GUIDED_TOURS.length, CASE_STUDIES_2026.length)` (`L171-176`).
2. **Enforce Canonical 7-Region & 6-Lens Enums (`L68-69`)**: Currently `coverageRegion` only checks `assertNonEmptyString` (`L68`). Add `assert.ok(CANONICAL_REGIONS_7.has(caseStudy.coverageRegion))` and `assert.ok(ISSUE_LENSES_6.has(caseStudy.issueLens))`.
3. **Portfolio Balance & Quota Matrix Assertions (Post-Expansion)**:
   - Every canonical region represents `>= 10%` and `<= 20%` of active cases;
   - Every issue lens represents `>= 12%` and `<= 22%` of active cases;
   - Once the 100-case expansion completes, every `(region, issueLens)` cell in the 7×6 matrix has `>= 2` active cases;
   - `featured === true` cases represent `10%–25%` of active cases (currently `17 / 29 = 59%` are `featured: true` because almost every case in Asia-Pacific and Americas/Global set `featured: true`!).
4. **`NEXUS_ACTORS` Coverage Floor (`L139-141`)**: Assert that **all 17 actors** in `focusData.NEXUS_ACTORS` (specifically including `CyberActors`) appear in `nexusNodeIds` of at least `1` active case after the Pilot Batch, and `>= 4` active cases at completion.
5. **Two-Tier Freshness Assertion (`L77`, `L84`)**:
   - Keep `assert.ok(caseStudy.updatedAt <= caseStudy.reviewBy)` as a hard failure;
   - Enforce `assert.equal(caseStudy.reviewBy, addDays(caseStudy.updatedAt, caseStudy.reviewCadenceDays))` (or within ±1 day) on newly authored cases so `updatedAt` cannot silently lag 6–12 months behind `reviewBy`;
   - Add a dedicated `npm run content:staleness` script (warning in local test, scheduled weekly issue/report in CI) comparing `reviewBy` against `new Date().toISOString().slice(0, 10)` so overdue cases are surfaced proactively without mysteriously breaking offline historical builds.
6. **Validate `supplementalSources[].alternateUrls` (`L127-137`) & Decouple Fixture ID (`L202`)**: Extend the `alternateUrls` HTTPS/label/non-duplicate check (`L111-115`) to `supplementalSources`, and use a dedicated synthetic or first-matching fixture for `eventAnalysis.generate5W1H` (`L202`) so archiving `'tuvalu-australia-falepili-union'` never crashes unit tests.

---

### 3.4 Phased Batch Plan & Review Gates

| Phase | Volume | Scope & Selection Rules | Mandatory Gate Before Next Batch |
|---|---:|---|---|
| **Phase 0: Infrastructure, Standard Update & 29-Case Triage** | 0 new (29 reviewed) | **Precondition:** Update `docs/CASE_STUDY_EDITORIAL_STANDARD.md` (`L84` & schema section) to formally define `status` (`'active' \| 'archived'`), `issueLens`, and the owner-approved 6-lens `broadCategory` mapping before authoring any v2 cases. Migrate directory layout to `src/cases/`, upgrade `refresh-source-health` to Background Function + configurable `8000ms` timeout, fix broken links (`#12`, `#18`, `#5`), and reconcile overdue `statusSummary`/`updatedAt`/`reviewBy` across existing 29 cases. | Updated `CASE_STUDY_EDITORIAL_STANDARD.md`, `npm test`, `npm run build`, live Background Function source-health check (`0 broken`), human sign-off on refreshed 29 cases. |
| **Batch 1: Pilot** | **10 cases** | **1–2 cases in each of the 7 regions**, covering **all 6 issue lenses** (including >= 2 `Governance & Rights` and >= 2 `Technology & Information` linked to `CyberActors`), exercising all 4 `map.mode` types (`point`, `regional`, `route`, `global`) and `living-reference` + `alternateUrls`. | **STOP — Full Pedagogical & Editorial Gate**: Human review of all 30 core URLs, classroom readability/focus-question audit in Guided Briefings, Globe pin clustering check, and Focus Nexus edge check. Adjust template rules if needed before scaling. |
| **Batch 2** | **15 cases** | Africa (+5), Middle East & North Africa (+5), Global / Transnational (+5) — prioritizing `Economy & Development`, `Governance & Rights`, and `Health & Human Security` zero-cells. | Automated CI (`contentIntegrity` + 15s URL reachability `0 broken`) + human editorial sign-off on all 15 cases. |
| **Batch 3** | **15 cases** | Asia-Pacific (+8), Pacific Islands (+7) — prioritizing `Governance & Rights`, `Security & Diplomacy` (Pacific), and `Technology & Information`. | Automated CI + human editorial sign-off + mid-point featured-balance check. |
| **Batch 4** | **15 cases** | Europe & Eurasia incl. Arctic (+8), Americas & Caribbean (+7) — prioritizing `Security & Diplomacy`, `Economy & Development`, `NATO`, and `Cartels`. | Automated CI + human editorial sign-off. |
| **Batch 5** | **15 cases** | Cross-regional non-state & industry network wave (`CyberActors`, `BiotechHub`, `TechAIHub`, `MilitantPMC`, `Hezbollah`, `Jihadist` quota completion across 7 regions). | Automated CI + Focus Nexus density/edge legibility audit at ~100 total cases. |
| **Batch 6** | **15 cases** | Remaining regional × lens cell-floor completion across Africa, MENA, Europe/Eurasia, and Americas. | Automated CI + human editorial sign-off. |
| **Batch 7** | **15 cases** | Final balancing wave across Pacific Islands, Global/Transnational, and Asia-Pacific + full 129-case portfolio audit. | Final `7×6` quota assertion locked (`>= 2` per cell), full `npm run build` bundle budget check, and full browser pass. |

---

### 3.5 Honest Effort Estimate & Agent-vs-Human Editorial Split

Strict adherence to `docs/CASE_STUDY_EDITORIAL_STANDARD.md` — three genuinely distinct standpoints (`local`, `institutional`, `independent`), primary-source claim verification, explicit uncertainty, non-monolithic `editorialCaution`, and pedagogically sound IB focus questions — **cannot** be safely mass-generated by an LLM unreviewed. Agents frequently hallucinate URL slugs, misread paywalled/403 summaries from snippets, or flatten a "local" perspective into a national government ministry press release when local communities contest that ministry.

#### Per-Case Time Breakdown: **75–105 minutes per case** (~1.25–1.75 hours)

| Step | Owner | Est. Time / Case | What an Agent Can Safely Do | What Requires Human Editorial Sign-Off |
|---|---|---:|---|---|
| **1. Topic Scoping & Matrix Slot Assignment** | Agent + Human | 5–10 min | Propose candidate topics filling exact `(region, issueLens, nexusNodeIds)` quota gaps; check overlap against existing cases. | Approve pedagogical relevance for IB Global Politics and framing neutrality before drafting. |
| **2. Three-Perspective Source Discovery & Link/Mirror Verification** | Agent scaffold → Human verify | 20–30 min | Search official registries (UN, ICJ, WTO, regional bodies, local newsrooms/civil society, academic journals); run live HTTP `HEAD`/`GET` reachability checks; locate legitimate institutional PDF/repository `alternateUrls` for `403` WAF domains; extract publication/cutoff dates. | **Read all three full sources directly**; confirm the `local` source genuinely reflects a proximate/affected constituency (not merely an external outlet datelined locally) and that `alternateUrls` do not bypass paywalls improperly. |
| **3. Drafting Record, Map Coordinates & 4–5 Waypoints** | Agent draft → Human edit | 15–20 min | Populate `CASE_TEMPLATE` schema, verify `latitude`/`longitude` coordinates, validate `nexusNodeIds` against `NEXUS_ACTORS`, draft initial `statusSummary`, `whyItMatters`, `uncertainty`, and 4–5 `waypoints`. | Verify **every numeric figure, date, legal status, and attributed position** word-for-word against the three sources; strip any unattributed synthesis or predictive language. |
| **4. Sensitivity, Caution & IB Pedagogical Review** | **Human only** | 25–30 min | Flag obvious high-sensitivity triggers (active armed conflict, displacement, contested sovereignty, Indigenous lands, biosecurity) and propose initial `reviewCadenceDays`. | Author/approve `editorialCaution` (terminology, legal naming such as Transnistria/Western Sahara/Somaliland, survivor dignity), calibrate `confidence` + `uncertainty`, and refine `focusQuestion`s for classroom seminar quality. |
| **5. Automated Validation & Visual QA** | Agent | 10–15 min | Run `npm run sources:manifest`, `npm test`, `npm run build`, and headless Playwright verification of the new case in Guided Briefings, Globe Editorial Cases pin, and Focus Nexus actor view. | Final PR sign-off at batch review gate. |
| **Total per Case** | **Hybrid** | **75–105 min** | **~20–25 min agent execution** (~33–42 hrs across 100 cases) | **~55–80 min human editorial review** (~92–133 hrs across 100 cases) |

---

## 4. Retiring & Archiving Cases Without Deleting History

### Why Deletion Breaks Classroom Workflows
Teachers embed `?view=briefings&tour=<case-id>&step=<n>` links directly into syllabi, LMS assignments, and IB Global Politics case portfolios. Currently (`src/GuidedBriefings.jsx:7,67,120-124,141-149`), if `<case-id>` is removed from `CASE_STUDIES_2026`, opening a saved link **silently defaults to `sudan-displacement-regional-spillover` and overwrites the browser URL via `window.history.replaceState`** with zero explanation. Conversely, leaving superseded cases inside `CASE_STUDIES_2026` forever clutters active Globe pins, inflates daily `refresh-source-health` runs, and surfaces permanently overdue warnings.

### Recommended Non-Destructive Archival Architecture

1. **Two-State Lifecycle (`status: 'active' | 'archived'`) + Archive Module (`src/cases/archive/archived-2026.mjs`)**:
   When an event concludes (e.g., an election roadmap expires, a treaty review concludes, or a newer case supersedes an older framing), move the record from `src/cases/active/<region>.mjs` to `src/cases/archive/archived-2026.mjs` with four immutable archival fields:
   ```js
   status: 'archived',
   archivedAt: '2027-02-15',
   archivedReason: 'Superseded after the December 2026 joint commission protocol entered into force.',
   supersededById: 'usmca-2027-commission-protocol', // optional active case ID
   ```
   Keep `statusSummary`, `updatedAt`, `sources`, and `waypoints` frozen as a dated historical record (*"Snapshot frozen on `updatedAt`"*).

2. **Surface-by-Surface Behavior**:
   - **`CASE_STUDIES_ACTIVE` (Default Browse)**: Drives the Globe **Editorial Cases** layer (`src/App.jsx:27,830`), default Intel Feed curated cards (`src/App.jsx:537`), Focus Nexus `Current cases` count (`src/NexusFocusView.jsx:47-55`), and the default Guided Briefings catalog (`src/GuidedBriefings.jsx`).
   - **Deep Links (`?view=briefings&tour=<case-id>&step=<n>`)**: `GuidedBriefings` resolves `<case-id>` against `ALL_CASE_STUDIES` (`active + archived`). When an `archived` case is opened via URL or toggle:
     - Preserve the exact `?tour=<archived-id>&step=<n>` URL (never overwrite it to index `0`);
     - Replace the red `"Source review overdue"` alert (`src/GuidedBriefings.jsx:322-325`) with a clear amber **Archived Historical Snapshot** banner displaying `updatedAt`, `archivedAt`, `archivedReason`, and—when `supersededById` is set—a one-click **"Open current successor briefing →"** button.
   - **Opt-In Classroom Archive Toggle**: Add a compact `"Show archived snapshots (N)"` checkbox inside the Guided Briefings filter bar (`src/GuidedBriefings.jsx:186-218`) so IB teachers and students can compare how an issue evolved over time.
   - **Source-Health & Tests**:
     - `contentIntegrity.node.test.mjs` continues validating schema, coordinates, `NEXUS_ACTORS`, and HTTPS source structure on `ARCHIVED_CASE_STUDIES` so archived tours never crash in React, while exempting `status === 'archived'` records from active rolling `reviewBy` overdue alerts.
     - `scripts/generate-source-health-manifest.mjs` tags archived URLs with `lifecycle: 'archived'` so daily cron checks prioritize `active` cases while checking `archived` links weekly (and encouraging Internet Archive / institutional repository `alternateUrls` before archiving).
