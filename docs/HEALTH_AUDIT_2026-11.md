# Global Command Center 2026 — Functional Health, Security & Code Audit (2026-11)

- **Audit Date:** 2026-11-15
- **Lead Agent:** Antigravity (operating as **Carbon**, synthesizing read-only research passes from subagents Hydrogen, Argon, and Nitrogen)
- **Repository:** `global-command-center-2026`
- **Inspected Branch:** `docs/audit-2026-11` (branched from `main` `ccac3d0`, which incorporates PR #32 `8cc1ead` and PR #33 `ccac3d0`; zero application source files modified)
- **Raw Audit Evidence Bundle:** `docs/audit-evidence/` (`playwright-audit-results.json`, `lighthouse-audit-results.json`, `source-health-live-2026-11-15.json`, `source-health-15s-2026-11-15.json`, `run-source-health.mjs`, `run-source-health-15s.mjs`, `gemini-deprecations-2026-11-15.md`, `npm-test-build-2026-11-15.txt`, `KNOWN_ISSUES_2026-11.patch`)
- **Fixed Stack:** React 18 (`^18.2.0` in `package.json:10-11`, resolved `18.3.1`), Vite 5 (`5.4.21` in `package.json:18`), Node 22 (`v22.23.1` / npm `10.9.8`), Netlify Functions, Supabase (`@supabase/supabase-js` `2.103.2` in `package.json:7`)

---

## 1. Executive Summary & `docs/KNOWN_ISSUES.md` Status Verification

The application builds cleanly (`4.58s` in committed log `docs/audit-evidence/npm-test-build-2026-11-15.txt:90`), passes all 38 automated tests (`714.63ms`, `0 fail`; `npm-test-build-2026-11-15.txt:60`), and preserves on-demand loading of its `1.34 MB` Three.js chunk when entering Guided Briefings (`?view=briefings`) or the 2D Focus Nexus (`?view=nexus`). Empirical runtime testing, backend inspection, and WCAG/Lighthouse audits uncovered **0 Blocking** issues, **10 High** issues (led by **F-01**, the **2026-12-01** Gemini API `gemini-3.5-flash-lite` auto-routing & parameter deprecation notice documented in `docs/audit-evidence/gemini-deprecations-2026-11-15.md`), **10 Medium** issues, and **6 Low** issues.

Per ground rules, existing items in `docs/KNOWN_ISSUES.md:3-12` were verified empirically rather than re-reported as new (proposed unified diff saved at `docs/audit-evidence/KNOWN_ISSUES_2026-11.patch`):

| Known Issue (`docs/KNOWN_ISSUES.md`) | Empirical Status (2026-11-15) | Verification Evidence & Code Citations |
|---|---|---|
| **#1 GDELT Reliability** (`L3`) | **Confirmed still present (partially mitigated)** | `src/nexusGDELT.js:58-76` still calls `https://api.gdeltproject.org/api/v2/doc/doc` directly from the browser without rate-limit/timeout protection when 3D Nexus opens (`docs/audit-evidence/playwright-audit-results.json:154-155`). |
| **#2 Distributed Rate Limiting** (`L4`) | **Worse than documented** | `netlify/functions/security.js:11,55-68,98-117` uses an unbounded in-memory `Map` (`requestBuckets`) shared across **all** protected functions per `userId` and calls Supabase `/auth/v1/user` (`L98-103`) with no timeout **before** rate-limit evaluation (`L117`). |
| **#3 Email Verification** (`L5`) | **Confirmed still present + 2 client bugs** | `src/AuthModal.jsx:64` passes full `window.location.href` (including stale query/hash) as `emailRedirectTo`, and `src/AuthModal.jsx:119-128` ignores `#error_code=otp_expired` redirect fragments. |
| **#4 Supabase RLS** (`L6`) | **Confirmed still present (unverified in repo)** | Zero `.sql` migrations or `supabase/` directory exist in the repo; 7 concrete client-side RLS/schema assumptions on `public.user_data` (`(user_id, key, value)`) remain unverified (Section 3.6), plus `.single()` `406` errors (`src/App.jsx:254-256`) and un-debounced `.upsert()` writes (`src/App.jsx:292-295`). |
| **#5 3D Chunk Size** (`L7`) | **Worse on app shell; confirmed on 3D chunk** | Deferred `three-render-objects` chunk remains `1,338.80 kB` (`361.78 kB` gzip) and still loads **only** on Globe or opt-in 3D Nexus, **but** the main app shell `dist/assets/index-*.js` grew **+48%** from documented `~297 kB` to **`439.74 kB`** (`137.82 kB` gzip) because all 29 case studies are statically imported into `src/App.jsx:10,27`. |
| **#6 External Map Assets** (`L8`) | **Confirmed still present + CSP regression** | `src/App.jsx:307-308,322` still fetches `unpkg.com` textures (`1.28 MB` via `302` redirects) and `cdn.jsdelivr.net` boundaries, **and** `netlify.toml:21` places `raw.githubusercontent.com` in `img-src` instead of `connect-src`, blocking the fallback GeoJSON `fetch()` at `src/App.jsx:336` in production. |
| **#7 Editorial Ownership & Review** (`L9`) | **Worse (100% overdue + 4 dead URLs)** | `CONTENT_REVIEW_DATE` (`src/caseStudies2026.js:12`) is `2026-08-10`; **all 29 / 29 cases** are **`8–95` days** past `reviewBy` as of `2026-11-15` (computed `reviewBy` runs from `2026-08-12` on `myanmar-fragmented-sovereignty` at `src/caseStudies2026.js:142` to `2026-11-07` at `src/caseStudiesAmericasGlobal2026.js:126`), 4 tracked URLs return `404` (`docs/audit-evidence/source-health-15s-2026-11-15.json:350-351,728-729,744-745,1024-1025`), and `netlify/functions/_shared/source-health.js:1` uses `CHECK_TIMEOUT_MS = 3000` that times out `103 / 106` targets on cold parallel TLS (`docs/audit-evidence/source-health-live-2026-11-15.json:4-9`). |
| **#8 Relationship Provenance** (`L10`) | **Worse (5 slipped timelines uncovered)** | Beyond unsourced structural edges in `src/GlobalRelationsNexus.jsx:330-370`, `EDGE_DESCRIPTIONS` in `src/nexusEdgeData.js:41-45,64-74,88-99` contains **5 slipped historical timelines** attributing unrelated regional conflicts/infrastructure to US–Europe, Hezbollah, and Cartels edges. |
| **#9 Vite 5 Dev Advisories** (`L11`) | **Worse (4 new High transitive advisories)** | `npm audit` reports the known Moderate `vite`/`esbuild` advisory **plus 4 High advisories** (`@fastify/busboy`, `nanoid`, `source-map-js`) resolvable non-breaking via `npm audit fix`. |
| **#10 Automated Feed Limits** (`L12`) | **Confirmed still present** | `netlify/functions/_shared/intel-snapshot.js:3-112` remains English-query Serper discovery with heuristic scoring. |

Also note two regressions against **`Recently Resolved`** claims in `docs/KNOWN_ISSUES.md`:
- `docs/KNOWN_ISSUES.md:19` claims production security policy avoids overly permissive rules, yet `netlify.toml:21` ships `script-src 'self' 'unsafe-inline' 'unsafe-eval'` while handler responses omit `Access-Control-Allow-Origin`.
- `docs/KNOWN_ISSUES.md:22` claims AI briefs preserve the article lead and conclusion (`12,000` chars in `netlify/functions/ai-summary.js:11,28-37`), which is **unreachable from the UI** because `netlify/functions/deep-scan.js:66-67` truncates scraped markdown to `3,000` chars before returning it to `src/App.jsx:621-625`.

---

## 2. Ranked Findings (Blocking -> High -> Medium -> Low)

### Summary Index

| ID | Severity | Status vs `KNOWN_ISSUES` | Primary Citation | Summary |
|---|---|---|---|---|
| **F-01** | **High** | New | `netlify/functions/ai-summary.js:8,142,146,150,155,169`, `netlify/functions/gemini-retry.js:8-10` | `gemini-2.5-flash` auto-routes to `gemini-3.5-flash-lite` on **2026-12-01** (`docs/audit-evidence/gemini-deprecations-2026-11-15.md`), deprecating `temperature: 0.3` (`ai-summary.js:150`) and replacing `thinkingBudget: 0` (`L155`) with `thinkingLevel: 'minimal'` per the migration checklist, while passing `?key=` in URL (`L142`), concatenating `SYSTEM_PROMPT` into `user` role (`L146`), masking empty/`SAFETY` responses as `200 OK` (`L169,185`), and risking `504` via a `~48.4s` retry budget (`gemini-retry.js:8-10`). |
| **F-03** | **High** | New | `src/App.css:1671-1677,2880-2904` | Duplicate `.theory-btn` CSS rules in `src/App.css` collide, rendering active Detail Modal theory buttons (`REALISM`, etc.) in `rgb(0,0,0)` on `rgb(30,33,44)` (**1.31:1** contrast at `7.2px`). |
| **F-04** | **High** | New | `netlify/functions/_shared/intel-snapshot.js:435,468`, `src/App.jsx:2309` | Critical Minerals Matrix is broken (`N/A` prices and truncated 2-letter symbols `GO, SI, LI, CO, CO, RA`) because `intel-snapshot.js` hardcodes `minerals: {}` while legacy authenticated `netlify/functions/fetch-intel.js:443-528` is orphaned. |
| **F-05** | **High** | Regression (`KNOWN_ISSUES:22`) | `netlify/functions/deep-scan.js:66-67`, `ai-summary.js:11,28-37`, `src/App.jsx:627-629` | `deep-scan.js:67` truncates Firecrawl markdown to `3,000` chars (defeating `ai-summary.js` 12k lead+conclusion preservation), and `src/App.jsx:627-629` swallows unauthenticated errors into generic `"⚠ Deep scan unavailable"`. |
| **F-06** | **High** | Worse (`KNOWN_ISSUES #8`) | `src/nexusEdgeData.js:41-45,64-74,88-99` | Five `EDGE_DESCRIPTIONS` timelines in 3D Nexus contain slipped historical events belonging to other actor pairs (`USA|Europe|tech`, `Hezbollah|MiddleEast|conflict`, `Hezbollah|USA|conflict`, `Cartels|LatinAmerica|conflict`, `Cartels|USA|conflict`). |
| **F-07** | **High** | New | `src/GlobalRelationsNexus.jsx:70-131,565-641,951-962,1000-1074`, `src/nexusAudio.js:156` | 3D Nexus runtime defects: per-link `d3Force` callback plays audio & mutates global X/Y forces (`L568-589`), stale `GPC_NODE_MAP`/`GPC_CONTEXT` IDs (`PMCs`, `GlobalInstitutions`, `GlobalPharmaMNCs`), broken `ArrowUp`/`ArrowDown` cycling (`L954,959`), stale closure/NaN camera math (`L606-641`), and leaked WebGL geometries/textures + WebAudio oscillators. |
| **F-08** | **High** | Worse (`KNOWN_ISSUES #6, L19`) | `netlify.toml:21`, `netlify/functions/fetch-news.js:144,215`, `ai-summary.js:106` | Security header/CORS gaps: `raw.githubusercontent.com` is in `img-src` instead of `connect-src` (blocking GeoJSON fallback `src/App.jsx:336`), `script-src` retains `'unsafe-inline' 'unsafe-eval'`, handler responses omit `Access-Control-Allow-Origin`, and authenticated `fetch-news.js` responses omit `Cache-Control: private, no-store`. |
| **F-09** | **High** | Worse (`KNOWN_ISSUES #2`) | `netlify/functions/security.js:11,55-68,98-117`, `deep-scan.js:7-19,31` | `security.js` shares one unbounded rate-limit `Map` across all endpoints per user and calls Supabase `/auth/v1/user` with no timeout prior to rate limiting; `deep-scan.js` allows `http:`, array coercion (`{"url":["..."]}`), and DNS-rebinding hosts (`nip.io`). |
| **F-10** | **High** | Worse (`KNOWN_ISSUES #3, #4`) | `src/supabase.js:12-14`, `.env.example:20`, `src/App.jsx:256,292-295`, `src/AuthModal.jsx:7,64` | Supabase client & sync defects: `.env.example` placeholder passes `isValidClientKey`, `.single()` causes `406` on first login, `stressLevel` slider fires un-debounced `.upsert()` storms, `!user.email` crashes `AuthBadge`, and `AuthModal` leaks focus & lacks `<label>`. |
| **F-11** | **High** | New | `src/App.jsx:129,803-815,1290-1291` | Sidebar intelligence feed (`filteredForecasts`) is mutated inside `updateGlobeData`, which aborts when `!globeEl.current` (`L804`), freezing category/year/editorial filters if WebGL fails or lags; hidden Globe canvas (`display: 'none'`) also keeps ticking WebGL rAF loops. |
| **F-02** | **Medium** | New | `teacher-guide.html:1,1161`, `guide-images/*`, `vite.config.mjs:4-15`, `public/_redirects:1` | `teacher-guide.html` and `guide-images/` (`12.7 MB`) sit at repo root outside `vite.config.mjs` (omitted from `dist/`, though unlinked from tracked UI), and `teacher-guide.html:1161` still documents the removed Student Pin feature. |
| **F-12** | **Medium** | Worse (`KNOWN_ISSUES #9`) | `package.json:5-22`, `package-lock.json` (`npm audit`) | `npm audit` exits `1` with **4 High** fixable transitive advisories (`@fastify/busboy`, `nanoid`, `source-map-js`) alongside 1 Moderate `vite`/`esbuild` dev-only advisory. |
| **F-13** | **Medium** | Worse (`KNOWN_ISSUES #7`) | `src/caseStudies2026.js:12,451`, `src/caseStudiesAfricaMena2026.js:231,235`, `src/caseStudiesAsiaPacific2026.js:145`, `netlify/functions/_shared/source-health.js:1` | All 29/29 cases are `8–95` days past `reviewBy`, 4 tracked URLs (`2` core primary, `1` core alternate, `1` supplemental) return `404`, and `CHECK_TIMEOUT_MS = 3000` (`source-health.js:1`) times out `103 / 106` targets on parallel cold TLS. |
| **F-14** | **Medium** | Worse (`KNOWN_ISSUES #5`) | `src/App.jsx:10,27`, `vite.config.mjs:4-15` | Main JS bundle `dist/assets/index-*.js` grew +48% to `439.74 kB` (`137.82 kB` gzip), and Mobile Globe Lighthouse Performance scores **33/100** (`LCP 48.6s`, `TBT 2,450ms`). |
| **F-15** | **Medium** | Confirmed (`KNOWN_ISSUES #6`) | `src/App.jsx:307-308,322,1882`, `index.html:9-11`, `src/nexusGDELT.js:61` | Runtime fetches 7 third-party URLs across 5 external origins (`unpkg.com` `302` redirects for `1.28 MB` globe textures, `cdn.jsdelivr.net` TopoJSON, render-blocking Google Fonts CSS, unsized `www.netlify.com` `301` badge, and direct browser `api.gdeltproject.org`). |
| **F-16** | **Medium** | New | `src/App.jsx:1628-1630,1657-1665` | `.intel-card` nests `<a className="card-link">` inside `<div role="button">` (invalid interactive-in-interactive HTML/ARIA) and sets an `aria-label` that fails Lighthouse `label-content-name-mismatch` (`score: 0`, WCAG 2.5.3). |
| **F-17** | **Medium** | New | `src/GlobalRelationsNexus.jsx.backup`, `.full`, `Global_Forecasts_2026_Enriched.csv`, `netlify/functions/fetch-intel.js` | `196 KB` of `.backup`/`.full` dead files, duplicated root `Global_Forecasts_2026_Enriched.csv`, orphaned `fetch-intel.js` (+ `fetch-intel.node.test.js`), `deno.lock`, `public/news_brief.json`, and unused `src/nexusNarrative.js` *(2026-11-17 correction: `public/context-cards/` — `index.html` + 5 Republican China `.jpg` portraits — is a live self-contained classroom teaching page at `/context-cards/`, NOT unreferenced PNG dead assets; restored with self-hosted `Playfair Display` WOFF2 fonts).* |
| **F-18** | **Medium** | New | `vite.config.mjs:4-15`, `index.html:1-14`, `package.json:24` | Bare `npm run dev` (`vite`) lacks function proxy/mocking so `/.netlify/functions/public-intel` and `source-health` return `200 text/html` (triggering `"⚠ CURRENT FEED UNAVAILABLE"`), and missing `<link rel="icon">` logs a `404` console error (failing Lighthouse `errors-in-console`). |
| **F-19** | **Medium** | New | `.env.example:12,20`, `docs/ENVIRONMENT.md:15`, `netlify/functions/fetch-intel.js:413` | Env config hygiene: `GNEWS_API_KEY` (`.env.example:12`, `docs/ENVIRONMENT.md:15`) is referenced **only** by orphaned `netlify/functions/fetch-intel.js:413`, while `.env.example:20` placeholder `sb_publishable_your_key_here` passes client key validation (`src/supabase.js:12-14`). |
| **F-20** | **Medium** | New | `src/GlobalRelationsNexus.jsx:8,198,216,503,625,866-903` | Unrendered/unreachable UI handlers in `GlobalRelationsNexus.jsx`: right-click `handleNodeRightClick` (`L866-873`) swallows the browser context menu via `event.preventDefault()` and sets `contextMenu` (`L216`) with **zero JSX rendering `contextMenu`**; `nexusNarrative.js` (`L8`) is imported but never called; `compareNode` (`L198,503,625`) relies on undocumented `window._lastClickShift` with no inspector UI. |
| **F-21** | **Low** | New | `src/App.jsx:1844` | Footer renders raw Markdown asterisks `**Stephen Martinez (Project Lead & IB Global Politics Teacher)**` literally in the DOM. |
| **F-22** | **Low** | New | `src/App.jsx:47,134,223`, `src/NexusFocusView.jsx:26,33`, `src/GlobalRelationsNexus.jsx:184,227` | `?view=nexus&actor=europe` (lowercase) silently falls back to `"United States"` because `actor` query parsing in `App.jsx:134,223` and `NEXUS_ACTORS[initialNodeId]` lookup in `NexusFocusView.jsx:26,33` are case-sensitive. |
| **F-23** | **Low** | New | `src/App.jsx:1882-1885` | Footer Netlify badge `<img>` lacks HTML `width` and `height` attributes and points to a `301`-redirected URL, failing Lighthouse `unsized-images` (`0.5`). |
| **F-24** | **Low** | New | `src/auth.css:45-56,104,123,195-204`, `src/GlobalRelationsNexus.css:301,348,465,572,1821`, `src/App.css:2842` | Secondary WCAG 2.1 AA contrast (`2.26:1–3.69:1`) and touch-target (`9.3×16px` `.gcc-auth-close`, `20×20px` checkboxes) failures across Auth Modal, 3D Nexus HUD, Arc Legend, and Footer CTA. |
| **F-25** | **Low** | New | `src/App.jsx:644-672`, `src/nexusFocusData.js:4-35`, `src/GlobalRelationsNexus.jsx:14-52,135-162` | Dead client-fallback `COORDS`/`inferCoords`/`inferCategory` inside `fetchLiveNews` (`src/App.jsx:644-672` — never called after client-side Serper fallback was removed at `L697`) plus duplicated anchor metadata/keyword regexes across `nexusFocusData.js` and `GlobalRelationsNexus.jsx`. |
| **F-26** | **Low** | New | `netlify/functions/fetch-news.js:117-129,221` | `fetch-news.js` sets `stale: true` on non-cached error fallback (`L221`) and parses relative timestamps with English-only regex (`L117-129`). |

---

### Detailed Findings (`file:line`, Evidence & One-Line Proposed Fixes)

#### Blocking

*None — no uncommitted regressions or confirmed hard-failing production endpoints were observed on the current branch (`F-01` is graded **High** below because Google's `2026-12-01` notice specifies automatic routing to `gemini-3.5-flash-lite` and ignores deprecated `temperature`, though `thinkingBudget: 0` should be live-verified and migrated ahead of `2026-12-01`).*

---

#### High

1. **F-01 — Imminent Gemini API Auto-Routing (`2026-12-01`), Deprecated `temperature` / `thinkingBudget` Migration & Request/Timeout Defects**
   - **Citations:** `netlify/functions/ai-summary.js:8-9,48,142,146,150,152,155,167-186`; `netlify/functions/gemini-retry.js:8-10,32,48-66`
   - **Verbatim External Notice (Committed Locally):** `docs/audit-evidence/gemini-deprecations-2026-11-15.md` (captured `2026-11-15` from `https://ai.google.dev/gemini-api/docs/deprecations#gemini-2.5-flash-models` and `https://ai.google.dev/gemini-api/docs/whats-new-gemini-3.6#migrate-to-gemini-3-5-flash-lite`, which `301`-redirect to `https://aistudio.google.com/docs/...` — `gemini-2.5-flash` is deprecated and effective **2026-12-01**, all API requests to `gemini-2.5-flash` automatically route to `gemini-3.5-flash-lite` and bill at `gemini-3.5-flash-lite` rates).
   - **Evidence:** `ai-summary.js:8` sets `const GEMINI_MODEL = process.env.GEMINI_SUMMARY_MODEL || 'gemini-2.5-flash'`, `L150` sends `temperature: 0.3`, and `L155` unconditionally sends `thinkingConfig: { thinkingBudget: 0 }`. Per Google's `gemini-3.5-flash-lite` migration guide (`docs/audit-evidence/gemini-deprecations-2026-11-15.md:50-69`), when `gemini-2.5-flash` auto-routes to `gemini-3.5-flash-lite` on **2026-12-01** (`16` days from audit date), `temperature` is deprecated/ignored and slated to return `400 Bad Request` in future generations, while `Migrate to gemini-3.5-flash-lite` configures `thinking_level` (`"minimal"` default) and cross-references the `3.6 Flash` parameter-deprecation checklist (`Replace thinking_budget with thinking_level`). Additionally:
     - `ai-summary.js:142` appends `?key=${geminiKey}` to the URL query string (exposing the API key in error traces/proxy logs) instead of sending the `x-goog-api-key` header.
     - `ai-summary.js:146` concatenates `SYSTEM_PROMPT + '\n\n' + userMessage` inside `role: 'user'` instead of top-level `systemInstruction`, weakening separation from scraped Firecrawl text.
     - `ai-summary.js:167-186` defaults empty `candidates` (e.g. `promptFeedback.blockReason === 'SAFETY'`) to `rawText = '{}'` (`L169`), which `sanitizeBrief({})` (`L185`) returns as HTTP `200` with `oneLiner: 'Analysis unavailable — insufficient article content.'` (`L48`).
     - `gemini-retry.js:8-10` sets `MAX_RETRIES = 2` (`3` attempts) × `REQUEST_TIMEOUT_MS = 15000` + backoff (`L48-53`, which does respect numeric `Retry-After` up to `10s`) = **`~48.4s`–`65s` worst-case**, exceeding Netlify synchronous function gateway limits (`~26s`) and risking unhandled `504` gateway timeouts (while `options.fallbackUrl` at `gemini-retry.js:32,55` is unused by `ai-summary.js:142`).
   - **Proposed Fix:** Update `ai-summary.js` to target `gemini-3.5-flash-lite` (or branch config by model family: `thinkingLevel: 'minimal'` and no `temperature` on `3.x` vs `thinkingBudget: 0` on `2.5-flash`), pass `x-goog-api-key` and `systemInstruction`, handle `promptFeedback.blockReason` explicitly, and cap total timeout + retry budget in `gemini-retry.js` under `22s`.

2. **F-03 — Detail Modal Active Theoretical Lens Button Renders Near-Invisible Black-on-Navy (`1.31:1` Contrast)**
   - **Citations:** `src/App.css:1654-1677`, `src/App.css:2880-2904`, `src/App.jsx:2063-2075`
   - **Evidence:** Playwright WCAG computed-style inspection on the Detail Modal (`docs/audit-evidence/playwright-audit-results.json:987-1000`, screenshot `docs/screenshots/ux-02-deepscan-signin-before.png`) measured `.theory-btn.active` (`REALISM`) at `color: rgb(0, 0, 0)` against resolved background `rgb(30, 33, 44)` = **1.31:1 contrast** (WCAG 2.1 AA requires `4.5:1`) at `7.2px` font size. Root cause: `src/App.css:1671-1677` sets `background: var(--theory-color); color: #000;` for modal theory buttons, and `src/App.css:2900-2904` (added later for Arc Legend `.theory-btn.active`) overrides `background: rgba(255, 255, 255, 0.08)` without resetting `color`, leaving `#000` text on a nearly transparent dark button while shrinking font size to `0.45rem` (`L2882`).
   - **Proposed Fix:** Rename the Arc Legend button class in `src/App.jsx` / `src/App.css:2880-2915` to `.legend-theory-btn` so `.detail-modal .theory-btn` (`src/App.css:1654-1677`) retains readable `>= 0.72rem` typography and `>= 7:1` contrast.

3. **F-04 — Critical Minerals Matrix Non-Functional (`N/A` Prices & Truncated Symbols) + Orphaned `fetch-intel.js`**
   - **Citations:** `netlify/functions/_shared/intel-snapshot.js:435,468`, `netlify/functions/public-intel.mjs:52`, `netlify/functions/fetch-intel.js:4,396,443-528`, `netlify/functions/__tests__/fetch-intel.node.test.js:4`, `src/App.jsx:142,2278-2334` (`L2309`)
   - **Evidence:** Live DOM inspection on `?view=globe` (`docs/audit-evidence/playwright-audit-results.json:369-384`) returned `mineralsSymbols: ["GO", "SI", "LI", "CO", "CO", "RA"]` (`gold` -> `GO`, `cobalt` & `copper` -> duplicate `CO`, `rareEarths` -> `RA` via `m.key.substring(0, 2).toUpperCase()` at `src/App.jsx:2309`) and `mineralsPrices: ["N/A", "N/A", "N/A", "N/A", "N/A", "N/A"]`. `intel-snapshot.js:435,468` and `public-intel.mjs:52` hardcode `minerals: {}`, while legacy `netlify/functions/fetch-intel.js` (`591` lines, authenticated via `protectEndpoint` at `L4,396`) is completely orphaned from the UI since `public-intel.mjs` replaced it.
   - **Proposed Fix:** Populate curated/cached mineral metadata with canonical symbols (`Au`, `Ag`, `Li`, `Co`, `Cu`, `REE`) in `intel-snapshot.js` + `src/App.jsx:2309` (or retire the modal), and delete orphaned `netlify/functions/fetch-intel.js` **together with** `netlify/functions/__tests__/fetch-intel.node.test.js:4`.

4. **F-05 — Deep Scan `3,000`-Char Truncation Defeats AI Brief `12,000`-Char Lead/Conclusion Preservation + Swallowed Sign-In Error**
   - **Citations:** `netlify/functions/deep-scan.js:66-67`, `netlify/functions/ai-summary.js:11,28-37`, `src/App.jsx:615-630`, `src/api.js:8`
   - **Evidence:** `ai-summary.js:11,28-37` implements `MAX_ARTICLE_CONTENT_LENGTH = 12000` with 70% lead + 30% conclusion preservation (`docs/KNOWN_ISSUES.md:22`), but `deep-scan.js:67` slices Firecrawl's markdown to `markdown.substring(0, 2997) + '...'` before returning it to `src/App.jsx:621-625`, amputating article conclusions on every long report. Separately, clicking `"🔥 FIRECRAWL + AI BRIEF"` while signed out (`docs/audit-evidence/playwright-audit-results.json:388`, screenshot `docs/screenshots/ux-02-deepscan-signin-before.png`) catches `src/api.js:8`'s `'Sign in to use live intelligence services.'` at `src/App.jsx:627-629` and overwrites it with generic `"⚠ Deep scan unavailable"`.
   - **Proposed Fix:** Raise `netlify/functions/deep-scan.js:67` excerpt cap to `15000` chars so `ai-summary.js:28-37` receives both lead and conclusion, and surface a direct `"Sign in to run Deep Scan"` CTA in `src/App.jsx:627-629` when `!user`.

5. **F-06 — Five Slipped Historical Timelines Corrupt Geopolitical Accuracy in 3D Nexus (`EDGE_DESCRIPTIONS`)**
   - **Citations:** `src/nexusEdgeData.js:6,41-45,64-74,88-99`
   - **Evidence:** Inspection of `EDGE_DESCRIPTIONS` in `src/nexusEdgeData.js` confirmed 5 edges whose `timeline` arrays slipped from other actor pairs in the file:
     - `USA|Europe|tech` (`L41-45`): contains `China|Africa|trade` events (`2013 Belt & Road Initiative launched`, `2017 Djibouti military base opens`, `2023 $170B cumulative BRI investment`).
     - `Hezbollah|MiddleEast|conflict` (`L64-69`): contains `NATO|Russia|conflict` events (`2014 Readiness Action Plan activated`, `2022 NATO 2022 Strategic Concept`, `2023 Finland joins NATO (31st member)`, `2024 Sweden joins — 300K high-readiness force`).
     - `Hezbollah|USA|conflict` (`L70-74`): contains `Cartels|USA|conflict` events (`2019 Fentanyl declared national emergency`, `2023 110K overdose deaths recorded`, `2024 Cartel-as-terrorist designation debated`).
     - `Cartels|LatinAmerica|conflict` (`L88-93`): contains `Hezbollah|MiddleEast|conflict` events (`2006 Lebanon War — 33 days`, `2015 Houthis seize Sanaa`, `2023 Oct 7 — Hezbollah opens northern front`, `2024 Houthi Red Sea shipping attacks`).
     - `Cartels|USA|conflict` (`L94-99`): contains `Russia|Europe|trade` events (`2011 Nord Stream 1 operational`, `2022 Russia cuts gas — EU scrambles`, `2022 Nord Stream pipelines destroyed`, `2023 EU Russian gas share drops to <15%`).
   - **Proposed Fix:** Re-align the 5 slipped `timeline` arrays in `src/nexusEdgeData.js:41-45,64-74,88-99` to their true actor pairs (moving each misplaced timeline to its matching edge and authoring `USA|Europe|tech` & `Cartels|LatinAmerica|conflict` timelines) and add an actor-keyword assertion in `src/__tests__/`.

6. **F-07 — 3D Spatial Nexus Force-Simulation Side Effects, Stale Actor IDs, Broken Keyboard Cycling & Resource Leaks**
   - **Citations:** `src/GlobalRelationsNexus.jsx:70-131,565-603,606-641,951-962,1000-1074`, `src/nexusFocusData.js:14-17`, `src/nexusAudio.js:156,160`
   - **Evidence:**
     - `src/GlobalRelationsNexus.jsx:565-601`: Inside `fg.d3Force('link').distance(lnk => ...)`, `NexusAudio.soundTheorySwitch()` (`L568`) and `fg.d3Force('y', ...)` / `fg.d3Force('x', ...)` (`L571-589`) execute **for every link during force evaluation**, and pass plain callbacks (`d => ...`) instead of `d3.forceX`/`d3.forceY` force instances.
     - `src/GlobalRelationsNexus.jsx:70-78,84,118-130`: `GPC_NODE_MAP` and `GPC_CONTEXT` reference obsolete actor IDs `'PMCs'`, `'GlobalInstitutions'`, and `'GlobalPharmaMNCs'`, whereas the canonical IDs in `src/nexusFocusData.js:14-17` and `PRIMARY_ANCHORS` (`src/GlobalRelationsNexus.jsx:24,25,27`) are `'MilitantPMC'`, `'UN_OPEC'`, and `'BiotechHub'`.
     - `src/GlobalRelationsNexus.jsx:951-962`: `ArrowDown`/`ArrowUp` connection cycling calls `connectionSummary.findIndex(c => c.id === selectedNode.id)` (`L954,959`), which is always `-1` because `connectionSummary` lists **neighbors** of `selectedNode` (not `selectedNode` itself), locking `ArrowDown` onto `connectionSummary[0]` and `ArrowUp` onto `connectionSummary[length - 1]`.
     - `src/GlobalRelationsNexus.jsx:606-641`: `handleNodeClick` has `[]` dependencies (`L641`, reading stale `lockedNode === null`), calls both `navigateToNode(node)` (`L630`) and `fgRef.current.cameraPosition(...)` (`L635`), and divides by `Math.hypot(node.x, node.y, node.z)` (`NaN` if `(0,0,0)`).
     - `src/GlobalRelationsNexus.jsx:1000-1074` & `src/nexusAudio.js:156,160`: Three.js geometries, materials, and `CanvasTexture` instances allocate without `.dispose()` on unmount, and `NexusAudio` starts ambient oscillators with no unmount cleanup.
   - **Proposed Fix:** Move theory audio/force registration out of `link.distance` into the `useEffect` body, repoint `GPC_NODE_MAP`/`GPC_CONTEXT` to `'MilitantPMC'`, `'UN_OPEC'`, and `'BiotechHub'`, track neighbor index via ref for arrow keys, fix `handleNodeClick` deps/zero-distance guard, and dispose Three.js + `NexusAudio` resources on unmount.

7. **F-08 — Production CSP Blocks GeoJSON Fallback, Retains `'unsafe-eval'`, & Omissions in Function CORS / Private Cache Headers**
   - **Citations:** `netlify.toml:14-48` (`L21`), `src/App.jsx:336`, `netlify/functions/ai-summary.js:106`, `deep-scan.js:25`, `fetch-news.js:144,169,215,221`, `public-intel.mjs:10`, `source-health.mjs:6`
   - **Evidence:**
     - `netlify.toml:21` puts `https://raw.githubusercontent.com` in `img-src` rather than `connect-src`, so if `cdn.jsdelivr.net` fails, the fallback `fetch('https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson')` at `src/App.jsx:336` is blocked by browser CSP.
     - `netlify.toml:21` includes `'unsafe-inline'` and `'unsafe-eval'` in `script-src` (`index.html` uses zero inline scripts).
     - `ai-summary.js:106`, `deep-scan.js:25`, and `fetch-news.js:215` construct fresh `headers` objects without merging `security.js`'s `responseHeaders(event)` (`Access-Control-Allow-Origin` for deploy-preview origins), so only `OPTIONS` (`204`) and error responses from `protectEndpoint` carry dynamic CORS headers.
     - `fetch-news.js:144,169,215,221` omits `Cache-Control: private, no-store` on authenticated custom search responses.
   - **Proposed Fix:** Bundle country boundaries locally (or move `raw.githubusercontent.com` to `connect-src`), drop `'unsafe-inline' 'unsafe-eval'` from `netlify.toml:21` `script-src`, export/reuse `responseHeaders(event)` from `netlify/functions/security.js` across all function responses, and set `Cache-Control: private, no-store` in `fetch-news.js`.

8. **F-09 — Pre-Rate-Limit Unbounded Auth Fetch, Shared Rate-Limit Map Leak & `deep-scan.js` SSRF Edge Cases**
   - **Citations:** `netlify/functions/security.js:11,55-68,98-127`, `netlify/functions/deep-scan.js:7-19,31-39`
   - **Evidence:**
     - `security.js:98-103` calls `fetch(${supabaseUrl}/auth/v1/user)` with **no `AbortSignal.timeout`** *before* checking `rateLimit(user.id, maxRequests)` (`L117`), allowing flooded expired/invalid Bearer tokens to tie up function concurrency on upstream auth round-trips.
     - `security.js:11,55-68` stores all per-user counters in a single module-global `requestBuckets = new Map()` keyed only by `userId` (never evicting inactive keys and sharing one quota bucket across `deep-scan`, `ai-summary`, and `fetch-news` — so one Deep Scan + AI Brief click consumes 2 ticks of `ai-summary`'s `maxRequests: 12` 15-minute window).
     - `deep-scan.js:7-19,31-39` permits `http:` URLs (`L10`), calls `new URL(url)` without `typeof url === 'string'` (allowing `{"url":["https://example.com"]}` array coercion), and checks hostname regexes without DNS resolution (permitting wildcard DNS-rebinding domains such as `127.0.0.1.nip.io`).
   - **Proposed Fix:** Add `AbortSignal.timeout(5000)` to `security.js:98`, namespace/prune `requestBuckets` by `${endpoint}:${user.id}`, and enforce `typeof url === 'string'`, `https:`-only, and DNS/IP validation in `deep-scan.js`.

9. **F-10 — Supabase Client Key Validation Bypass, `.single()` `406`, Un-Debounced Upserts & Auth UI Crashes**
    - **Citations:** `.env.example:20`, `src/supabase.js:12-14`, `src/App.jsx:254-256,292-295`, `src/AuthModal.jsx:7,40-128`
    - **Evidence:**
      - `.env.example:20` sets `VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key_here`, which starts with `sb_publishable_` and **passes** `isValidClientKey` (`src/supabase.js:12-14`), enabling broken auth UI if `.env.example` is copied verbatim.
      - `src/App.jsx:254-256` queries `.from('user_data').select('value').eq('user_id', user.id).eq('key', 'gcc-preferences').single()`, which returns HTTP `406 Not Acceptable` from PostgREST for every brand-new user with `0` rows.
      - `src/App.jsx:275-296` triggers `supabase.from('user_data').upsert({ user_id: user.id, key: 'gcc-preferences', value: prefs }, { onConflict: 'user_id,key' })` on every `stressLevel` slider tick with **no debounce**.
      - `src/AuthModal.jsx:7` calls `user.email.split('@')[0]` without optional chaining, crashing React if `user.email` is null/empty.
      - `src/AuthModal.jsx:40-112` has no focus trap (`focusEscapedAuthModal: true`, `docs/audit-evidence/playwright-audit-results.json:389`) and `#gcc-auth-email` (`L85-95`) has no `<label>` or `aria-label` (`unlabelledInputs` in `docs/audit-evidence/playwright-audit-results.json:1241-1247`).
    - **Proposed Fix:** Reject placeholder keys in `src/supabase.js:12-14`, switch `.single()` to `.maybeSingle()`, debounce `user_data` `.upsert()` (`400ms`), guard `user.email?.split('@')[0] || 'Operator'`, and add focus trapping + `<label htmlFor="gcc-auth-email">` in `AuthModal.jsx`.

10. **F-11 — Sidebar Intelligence Feed Coupled to WebGL `globeEl.current` + Unpaused Hidden Globe rAF Loop**
    - **Citations:** `src/App.jsx:129,803-815,1290-1291`
    - **Evidence:** `filteredForecasts` is stored in `useState([])` (`src/App.jsx:129`) and updated inside `updateGlobeData` (`L803-815`), which begins with `if (!globeEl.current) return;` (`L804`). Whenever the lazy `globe.gl` chunk is still loading, WebGL initialization fails, or filters change while `globeEl.current` is unmounted, `setFilteredForecasts(filtered)` (`L815`) never runs. Conversely, when switching to `briefings` or `nexus`, `src/App.jsx:1290-1291` hides `.globe-container` via inline `style={{ display: 'none' }}` while leaving the mounted WebGL `Globe` `requestAnimationFrame` loop running.
    - **Proposed Fix:** Derive `filteredForecasts` via `useMemo(() => filterIntelForecasts(...), [...])` independent of `globeEl.current`, and pause Globe animation/controls when `viewMode !== 'globe'`.

---

#### Medium

11. **F-02 — `teacher-guide.html` & `guide-images/` Excluded from Production Build (`dist/`) + Stale Pin Guide**
    - **Citations:** `teacher-guide.html:1-1468` (specifically `L1161`), `guide-images/*`, `vite.config.mjs:4-15`, `public/_redirects:1`
    - **Evidence:** In Vite dev (`http://127.0.0.1:5173/teacher-guide.html`), Playwright recorded `200 OK` and loaded all 7 `2880×1564` PNGs (`12.7 MB` total; `docs/audit-evidence/playwright-audit-results.json:475-521`). However, `npm run build` output (`dist/`) omits both `teacher-guide.html` and `guide-images/` because they sit at repo root outside `public/` and `vite.config.mjs:4-15` defines only the default `index.html` entry (no tracked UI component currently links to `/teacher-guide.html`, though direct navigation in production falls through `public/_redirects:1` `/* /index.html 200` to the React SPA shell; note `public/CODE_OF_CONDUCT.md` *is* present and copied to `dist/CODE_OF_CONDUCT.md`). Furthermore, `teacher-guide.html:1161` (`guide-images/feature-student-pin.png`) still documents the removed Student Pin workflow.
    - **Proposed Fix:** Either wire `teacher-guide.html` as a multi-page Rollup input in `vite.config.mjs` with compressed WebP/PNG guide images and update `teacher-guide.html:1161` to document Guided Briefings, or move it under `docs/` if intended strictly as repository documentation.

12. **F-12 — Four Fixable High-Severity `npm audit` Advisories**
    - **Citations:** `package.json:5-22`, `package-lock.json`
    - **Evidence:** `npm audit` exited with code `1`, reporting **5 vulnerabilities (1 moderate, 4 high)**: `@fastify/busboy <=3.2.1` (High, via `@netlify/blobs -> @netlify/dev-utils -> @whatwg-node/node-fetch`), `nanoid <3.3.18` (High, via `postcss`), `source-map-js 1.0.0 - 1.2.1` (High, via `postcss`), and `esbuild <=0.24.2` / `vite <=6.4.3` (Moderate, dev-only, documented in `KNOWN_ISSUES #9`). All 4 High advisories resolve via non-breaking `npm audit fix`.
    - **Proposed Fix:** Run `npm audit fix` (without `--force`, keeping `vite@5.4.21`) to clear all 4 High transitive advisories and re-run `npm test && npm run build`.

13. **F-13 — All 29 Editorial Cases Overdue (`8–95d`), 4 Tracked Source URLs Return `404`, and `3,000ms` Local Checkers Time Out `103/106` Targets**
    - **Citations:** `src/caseStudies2026.js:12,142,451`, `src/caseStudiesAfricaMena2026.js:231,235`, `src/caseStudiesAsiaPacific2026.js:145`, `netlify/functions/_shared/source-health.js:1,49,54`
    - **Evidence:** Live execution via `docs/audit-evidence/run-source-health.mjs` (`source-health-live-2026-11-15.json` at `CHECK_TIMEOUT_MS = 3000`, `concurrency = 16`) and `docs/audit-evidence/run-source-health-15s.mjs` (`source-health-15s-2026-11-15.json` at `TIMEOUT_MS = 15000`, `concurrency = 8`) confirmed:
      - **29 / 29 cases** are **`8–95` days** past `reviewBy` (`CONTENT_REVIEW_DATE = '2026-08-10'` at `src/caseStudies2026.js:12`; normalized `reviewBy` spans `2026-08-12` on `#2 myanmar-fragmented-sovereignty` to `2026-11-07` on `#25` & `#28`; see full per-case table in `docs/CASE_STUDY_EXPANSION_PLAN.md:34-64`).
      - **4 of 106 tracked URLs return HTTP `404` (`broken`)** (`docs/audit-evidence/source-health-15s-2026-11-15.json:350-351,728-729,744-745,1024-1025`):
        1. `somaliland-recognition-red-sea-order:core:0` (`src/caseStudiesAfricaMena2026.js:231`, Horn Tribune article)
        2. `somaliland-recognition-red-sea-order:core:0:alternate:0` (`src/caseStudiesAfricaMena2026.js:235`, Horn Tribune print PDF — leaving case `#12` with **0 healthy URLs** across all 5 links!)
        3. `bangladesh-ldc-graduation-decision:core:1` (`src/caseStudiesAsiaPacific2026.js:145`, `https://www.un.org/ldcportal/node/858`)
        4. `guyana-venezuela-essequibo-icj:supplemental:0` (`src/caseStudies2026.js:451`, Venezuela MPPRE statement).
      - At `CHECK_TIMEOUT_MS = 3000` (`concurrency = 16`), **`103` of `106` targets** timed out locally as `unknown` (`1 healthy, 2 restricted, 0 broken, 103 unknown`), whereas at `15000ms` (`concurrency = 8`) in `run-source-health-15s.mjs` the `106` targets resolved as **`69 healthy, 24 restricted (403), 4 broken (404), 9 unknown`** (`61 healthy, 17 restricted, 2 broken, 7 unknown` across the `87` core primary URLs). *(Note three differences between the two scripts: timeout `3000ms` vs `15000ms`, concurrency `16` vs `8`, and `run-source-health-15s.mjs:40-43` also retries `Range: bytes=0-0` `GET` on `HEAD 403` and catches `GET` errors whereas production `source-health.js:33` retries only on `405`/`501` — so `HEAD 403` publishers accepting a `Range` `GET` count as `healthy` in the `15s` run rather than `restricted`; run a controlled `3000ms` pass at `concurrency = 4` using exact `source-health.js` rules before tuning, and note `source-health.js:49` checks only `error?.name === 'AbortError'`, missing `TimeoutError` if `AbortSignal.timeout()` is used).*
    - **Proposed Fix:** Replace the 4 broken `404` URLs (prioritizing `#12 somaliland-recognition-red-sea-order` and `#18 bangladesh-ldc-graduation-decision`), refresh overdue `updatedAt`/`reviewBy` metadata, and add a configurable `timeoutMs` option (`8000ms` default, handling both `AbortError` and `TimeoutError` at `L49`) + per-host throttling in `netlify/functions/_shared/source-health.js:1,49,54`.

14. **F-14 — App Shell Bundle Grew +48% (`439.74 kB`) & Mobile Globe Lighthouse Performance Scores `33/100`**
    - **Citations:** `src/App.jsx:10,27`, `vite.config.mjs:4-15`
    - **Evidence:** `npm run build` produced `dist/assets/index-ZmiksjGk.js` at `439.74 kB` (`137.82 kB` gzip) alongside `globe.gl` (`488.05 kB`) and `three-render-objects` (`1,338.80 kB`). Lighthouse Mobile on `?view=globe` (`docs/audit-evidence/lighthouse-audit-results.json:132-145`) scored **Performance 33** (`FCP 2.5s`, `LCP 48.6s`, `TBT 2,450ms`, `TTI 51.2s`).
    - **Proposed Fix:** Split curated case payloads into a dedicated `manualChunks` asset and cap mobile Globe polygon/arc density + pixel ratio on viewports `< 768px`.

15. **F-15 — Seven Third-Party Runtime Asset/Font/API Dependencies Across Five External Origins**
    - **Citations:** `src/App.jsx:307-308,322,336,1882`, `index.html:9-11`, `src/nexusGDELT.js:61`
    - **Evidence:** Network capture (`docs/audit-evidence/playwright-audit-results.json:355-366,447-466`) recorded external runtime fetches to `unpkg.com` (`302` redirect to `unpkg.com/three-globe@2.45.6/...` transferring `715.6 KB` `earth-night.jpg` + `568.4 KB` `night-sky.png`), `cdn.jsdelivr.net` (`countries-110m.json`), `fonts.googleapis.com` + `fonts.gstatic.com` (render-blocking CSS saving `960–1,880ms` in Lighthouse `render-blocking-insight`), `www.netlify.com/img/global/badges/netlify-color-accent.svg` (`301` redirect), and `api.gdeltproject.org` (when 3D Nexus opens).
    - **Proposed Fix:** Self-host `countries-110m.json`, compressed WebP/JPG globe textures, `Orbitron`/`Roboto Mono` WOFF2 subsets, and the Netlify SVG badge under `public/assets/`, and proxy GDELT via a cached Netlify Function.

16. **F-16 — Invalid Interactive-Inside-Interactive Markup & Accessible-Name Mismatch on `.intel-card`**
    - **Citations:** `src/App.jsx:1628-1630,1657-1665`
    - **Evidence:** Lighthouse failed `label-content-name-mismatch` (`score: 0` on `globe`, `briefings`, and `nexus`; `docs/audit-evidence/lighthouse-audit-results.json:65-69,292-296,504-508`). `src/App.jsx:1628-1630` puts `role="button" tabIndex="0" aria-label="Open intelligence detail: ..."` on `<div className="intel-card">`, overriding visible badge/category text inside the card and nesting `<a className="card-link">OPEN SOURCE ↗</a>` (`L1657-1665`) inside a `role="button"` container (invalid HTML5/ARIA).
    - **Proposed Fix:** Render `.intel-card` as `<article>` containing a primary `<button type="button" className="intel-card-trigger">` around the title/summary and a sibling `<a className="card-link">` so visible text matches the accessible name without nested interactive controls.

17. **F-17 — Dead Backups, Duplicate CSV & Orphaned Modules *(2026-11-17 Correction on `public/context-cards/`)* **
    - **Citations:** `src/GlobalRelationsNexus.jsx.backup`, `src/GlobalRelationsNexus.jsx.full`, `Global_Forecasts_2026_Enriched.csv`, `netlify/functions/fetch-intel.js`, `netlify/functions/__tests__/fetch-intel.node.test.js:4`, `deno.lock`, `public/news_brief.json`, `src/nexusNarrative.js`
    - **Evidence:** Dead/duplicate artifacts verified via repo-wide search: `src/GlobalRelationsNexus.jsx.backup` (`100 KB`), `src/GlobalRelationsNexus.jsx.full` (`96 KB`), root `Global_Forecasts_2026_Enriched.csv` (`70 KB`, duplicate of `public/Global_Forecasts_2026_Enriched.csv`; note root `CODE_OF_CONDUCT.md` is intentionally kept alongside `public/CODE_OF_CONDUCT.md` so GitHub's community profile and Netlify deploy both resolve), orphaned `netlify/functions/fetch-intel.js` (`591L`, authenticated via `protectEndpoint` at `L4,396`, required only by `netlify/functions/__tests__/fetch-intel.node.test.js:4`), `deno.lock`, `public/news_brief.json`, and `src/nexusNarrative.js` (imported at `GlobalRelationsNexus.jsx:8` with zero calls). **Correction (`2026-11-17`):** The initial audit mistakenly described `public/context-cards/` as unreferenced `1927–1936` PNGs; it is in fact a live, self-contained classroom teaching page at `/context-cards/` (`public/context-cards/index.html` + 5 public-domain `.jpg` portraits: `charlie_soong.jpg`, `ding_ling.jpg`, `lao_she.jpg`, `lin_qiaozhi.jpg`, `lu_xun.jpg`). It has been restored, upgraded to self-hosted `Playfair Display` WOFF2 fonts (`font-src 'self'`), and added to automated build and source-health checks.
    - **Proposed Fix:** Remove unreferenced backups, duplicate root CSV, `deno.lock`, `public/news_brief.json`, `src/nexusNarrative.js`, and `netlify/functions/fetch-intel.js` (removing `fetch-intel.node.test.js` in the same commit), while preserving `public/context-cards/` as a live static classroom route.

18. **F-18 — Bare `npm run dev` Serves HTML for `/.netlify/functions/*` & `404`s on Missing Favicon**
    - **Citations:** `package.json:24`, `vite.config.mjs:4-15`, `index.html:1-14`
    - **Evidence:** Under `npm run dev` (`vite`), Playwright captured `GET /.netlify/functions/public-intel -> 200 text/html` and `GET /.netlify/functions/source-health -> 200 text/html` (`docs/audit-evidence/playwright-audit-results.json:60-73`), forcing fallback to `"⚠ CURRENT FEED UNAVAILABLE · 56 PUBLIC SOURCES"`, plus a browser console `404 (Not Found)` on `/favicon.ico` (`L32-34`) that caused Lighthouse `errors-in-console` to score `0` across all views.
    - **Proposed Fix:** Add `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />` to `index.html` and add a lightweight Vite dev middleware in `vite.config.mjs` returning `public/live_intel.json` / `404 JSON` when Netlify CLI is not running.

19. **F-19 — Legacy `GNEWS_API_KEY` Documentation Drift & Placeholder Client Key Prefix**
    - **Citations:** `.env.example:12,20`, `docs/ENVIRONMENT.md:15`, `netlify/functions/fetch-intel.js:413`, `src/supabase.js:12-14`
    - **Evidence:** Auditing every `process.env.*` and `import.meta.env.*` reference across `src/` and `netlify/` confirmed `GEMINI_SUMMARY_MODEL` is properly documented in both `.env.example:10` and `docs/ENVIRONMENT.md:13`, **but** `GNEWS_API_KEY` (`.env.example:12`, `docs/ENVIRONMENT.md:15`) is read exclusively by orphaned `netlify/functions/fetch-intel.js:413` (unused by `intel-snapshot.js` or `fetch-news.js`), and `.env.example:20`'s `sb_publishable_your_key_here` satisfies `src/supabase.js:13`'s `key.startsWith('sb_publishable_')` check.
    - **Proposed Fix:** Remove `GNEWS_API_KEY` from `.env.example` and `docs/ENVIRONMENT.md` when retiring `fetch-intel.js`, and change `.env.example:20` placeholder (plus `src/supabase.js:12-14` validation) so example values never pass `isValidClientKey`.

20. **F-20 — Swallowed Right-Click Context Menu, Dead Narrative Import & Undocumented `compareNode` Global in `GlobalRelationsNexus.jsx`**
    - **Citations:** `src/GlobalRelationsNexus.jsx:8,198,216,503,625,866-903`
    - **Evidence:** `handleNodeRightClick` (`L866-873`) calls `event.preventDefault()` and populates `contextMenu` state (`L216`), and `contextAction` (`L875-903`) defines menu actions, **but zero JSX in `GlobalRelationsNexus.jsx` renders `contextMenu`**, silently breaking the browser's native right-click menu. In addition, `generateNodeNarrative` and `generateEdgeNarrative` (`L8`) are never called anywhere in the file, and `compareNode` (`L198,503,625`) relies on an undeclared `window._lastClickShift` property (`L625`) with no comparison drawer rendered.
    - **Proposed Fix:** Either render the `contextMenu` popover (or remove `handleNodeRightClick`/`contextMenu`/`contextAction`), delete the unused `nexusNarrative.js` import (`L8`), and wire or prune `compareNode` (`L198,625`).

---

#### Low

21. **F-21 — Raw Markdown Asterisks Rendered in Footer Attribution**
    - **Citations:** `src/App.jsx:1844`
    - **Evidence:** Playwright DOM check (`footerHasLiteralAsterisks: true`, `docs/audit-evidence/playwright-audit-results.json:391`) confirmed `src/App.jsx:1844` renders literal `**Stephen Martinez (Project Lead & IB Global Politics Teacher)**` inside JSX text.
    - **Proposed Fix:** Replace `**Stephen Martinez (Project Lead & IB Global Politics Teacher)**` at `src/App.jsx:1844` with `<strong>Stephen Martinez (Project Lead &amp; IB Global Politics Teacher)</strong>`.

22. **F-22 — Case-Sensitive `?actor=` Deep Link Parameter in Focus & 3D Nexus**
    - **Citations:** `src/App.jsx:47,134,223`, `src/NexusFocusView.jsx:26,33`, `src/GlobalRelationsNexus.jsx:184,227`
    - **Evidence:** Playwright route check (`docs/audit-evidence/playwright-audit-results.json:139`) confirmed `?view=nexus&actor=Europe` focuses `"European Union and United Kingdom"`, whereas `?view=nexus&actor=europe` silently falls back to `"United States"` because `App.jsx:134,223` passes the raw query string into exact-key lookups `NEXUS_ACTORS[initialNodeId]` (`NexusFocusView.jsx:26,33`) and `PRIMARY_ANCHORS[initialNodeId]` (`GlobalRelationsNexus.jsx:184,227`).
    - **Proposed Fix:** Normalize `?actor=` case-insensitively against `Object.keys(NEXUS_ACTORS)` in a shared `resolveActorId` helper before setting `nexusEntry.nodeId`.

23. **F-23 — Unsized & `301`-Redirected Netlify Footer Badge**
    - **Citations:** `src/App.jsx:1882-1885`
    - **Evidence:** `https://www.netlify.com/img/global/badges/netlify-color-accent.svg` returns `301` to `/assets/badges/netlify-badge-color-accent.svg` (`docs/audit-evidence/playwright-audit-results.json:75-88`) and lacks HTML `width`/`height` attributes (using inline `style={{ height: '35px', width: 'auto' }}`), causing Lighthouse `unsized-images` (`0.5`) across all views.
    - **Proposed Fix:** Serve the SVG locally from `/assets/netlify-badge-color-accent.svg` with explicit `width="114" height="51"` attributes at `src/App.jsx:1882-1885`.

24. **F-24 — Secondary WCAG 2.1 AA Contrast & Touch-Target Deficits Across Auth Modal, 3D HUD & Footer**
    - **Citations:** `src/auth.css:45-56,104,123,195-204`, `src/GlobalRelationsNexus.css:301,348,465,572,1821`, `src/App.css:1419,1585,1590,2524,2842`, `src/App.jsx:1850-1863`
    - **Evidence:** Playwright WCAG pass (`docs/audit-evidence/playwright-audit-results.json:555-1360`) measured contrast below `4.5:1` on `.gcc-auth-close` (`2.26:1`, `9.3×16px`), `.auth-signout` (`2.26:1`, `~10×14px`), `.gcc-auth-subtitle` (`2.62:1`), `.hud-tab` (`2.68:1`), `.section-label` (`2.76:1`), `.nexus-hint` (`3.01:1`), `OPEN ACCESS CODE OF CONDUCT` (`3.14:1` at `src/App.jsx:1850-1863`), `.inspect-tab`/`.inspect-close` (`3.59:1`), and `.arc-legend-title` (`3.69:1`), plus `<44×44px` hit areas on 3D HUD checkboxes (`20×20px`), `.skip-nav` (`36px`), mobile `.back-to-top` (`36px`), and `.case-study-briefing-btn` (`36.8px`).
    - **Proposed Fix:** Apply the Tier A token & `min-height: 44px` hit-area CSS adjustments detailed in `docs/UX_ASSESSMENT_2026-11.md`.

25. **F-25 — Dead Client-Fallback `COORDS` in `App.jsx` & Duplicated Anchor Tables Across Nexus Views**
    - **Citations:** `src/App.jsx:644-672`, `src/nexusFocusData.js:4-22`, `src/GlobalRelationsNexus.jsx:14-60,135-162`
    - **Evidence:** `COORDS`, `inferCoords`, and `inferCategory` inside `fetchLiveNews` (`src/App.jsx:644-672`) are completely dead code left behind when direct browser Serper calls were removed (`L697`). Meanwhile, the 17 geopolitical actors are defined twice with diverging names/colors (`NEXUS_ACTORS` in `src/nexusFocusData.js:4-22` vs `PRIMARY_ANCHORS`/`ANCHOR_DESCS` in `src/GlobalRelationsNexus.jsx:14-52`).
    - **Proposed Fix:** Delete unused `COORDS`/`inferCoords`/`inferCategory` (`src/App.jsx:644-672`) and derive `PRIMARY_ANCHORS` from canonical `NEXUS_ACTORS` in `src/nexusFocusData.js`.

26. **F-26 — `fetch-news.js` Misleading `stale: true` Flag on Cold Fallback & English-Only Relative Dates**
    - **Citations:** `netlify/functions/fetch-news.js:117-129,221`
    - **Evidence:** When Serper fails with no prior cache entry, `fetch-news.js:221` returns `{ nodes: [], stale: true }` despite never having cached data; `L117-129` parses relative dates (`"3 hours ago"`) via English-only regex.
    - **Proposed Fix:** Return `stale: false, degraded: true` when no cached payload exists at `netlify/functions/fetch-news.js:221`.

---

## 3. Phase 1 Empirical Functional Health Record

### 3.1 Exact Command Outputs & Bundle Sizes

Executed under Node `v22.23.1`, npm `10.9.8`:

1. **`npm install`** (exit `0`):
   ```text
   up to date, audited 174 packages in 27s
   37 packages are looking for funding
   5 vulnerabilities (1 moderate, 4 high)
   ```

2. **`npm test`** (exit `0`, `714.63ms` in committed log `docs/audit-evidence/npm-test-build-2026-11-15.txt:60`):
   ```text
   > global-command-center@1.0.0 test
   > npm run sources:manifest:check && node --test netlify/functions/__tests__/*.node.test.js src/__tests__/*.node.test.*

   ℹ tests 38 | suites 0 | pass 38 | fail 0 | cancelled 0 | skipped 0 | todo 0 | duration_ms 714.628667
   ```

3. **`npm run build`** (exit `0`, `4.58s` in committed log `docs/audit-evidence/npm-test-build-2026-11-15.txt:90`, `628 modules` transformed, `Wrote 106 source-health targets across 29 cases`):
   | Built Asset (`dist/`) | Raw Size | Gzip Size | Load Timing |
   |---|---:|---:|---|
   | `dist/index.html` | `1.31 kB` | `0.63 kB` | Initial HTML |
   | `dist/assets/index-CBNYZJ2R.css` | `65.93 kB` | `13.36 kB` | Initial app shell CSS |
   | `dist/assets/NexusWorkspace-XDpF2poP.css` | `14.29 kB` | `3.11 kB` | Lazy (`?view=nexus`) |
   | `dist/assets/GuidedBriefings-BcNJOnDO.css` | `14.47 kB` | `3.17 kB` | Lazy (`?view=briefings`) |
   | `dist/assets/GlobalRelationsNexus-DjeG5IfZ.css` | `33.88 kB` | `6.82 kB` | Lazy (opt-in 3D Nexus) |
   | `dist/assets/NexusWorkspace-CQ24V3aQ.js` | `8.74 kB` | `3.05 kB` | Lazy (`?view=nexus`) |
   | `dist/assets/GuidedBriefings-BalLlynj.js` | `11.31 kB` | `3.97 kB` | Lazy (`?view=briefings`) |
   | `dist/assets/nexusFocusData-iad9gyr-.js` | `26.16 kB` | `9.87 kB` | Lazy (`?view=nexus`) |
   | `dist/assets/GlobalRelationsNexus-D222hW-H.js` | `171.90 kB` | `55.45 kB` | Lazy (opt-in 3D Nexus) |
   | `dist/assets/index-ZmiksjGk.js` | **`439.74 kB`** | **`137.82 kB`** | Initial app shell (+48% vs `KNOWN_ISSUES` `~297 kB`) |
   | `dist/assets/globe.gl-BXtVD3aW.js` | **`488.05 kB`** | **`159.43 kB`** | Lazy (`?view=globe` only) |
   | `dist/assets/three-render-objects-DW1eJVxJ.js` | **`1,338.80 kB`** | **`361.78 kB`** | Lazy (`?view=globe` or opt-in 3D Nexus; triggers Vite `>500 kB` warning) |

4. **`npm audit`** (exit `1`):
   - **4 High** (fixable via `npm audit fix`): `@fastify/busboy <=3.2.1` (via `@netlify/blobs`), `nanoid <3.3.18` (via `postcss`), `source-map-js 1.0.0 - 1.2.1` (via `postcss`).
   - **1 Moderate** (blocked by fixed Vite 5 stack constraint): `esbuild <=0.24.2` / `vite <=6.4.3` (fix requires breaking upgrade to `vite@8.3.8`).

---

### 3.2 Live Route Exercise Matrix (`npm run dev` + Headless Chrome / Playwright)

Raw JSON log committed at `docs/audit-evidence/playwright-audit-results.json`.

| Route / Feature Exercised | Result | Empirical Observations (`docs/audit-evidence/playwright-audit-results.json`) |
|---|---|---|
| `?view=globe` | **Renders; 2 UI bugs** | Globe + 56 fallback sources + 29 editorial markers render; Critical Minerals shows `GO, SI, LI, CO, CO, RA` & `N/A` (**F-04**); footer shows literal `**Stephen Martinez...**` (**F-21**). |
| `?view=briefings&tour=tuvalu-australia-falepili-union&step=3` | **Pass (0 Three.js)** | `threeOrGlobeLoadedOnBriefings = false`; renders `"Tuvalu–Australia Falepili Union"` at `"STEP 3 / 4"`, survives full reload at `"STEP 3 / 4"`, advances to `"STEP 4 / 4"`, shows `"Source review overdue since 2026-09-09"`, and hands off cleanly to `?view=nexus&actor=UN_OPEC`. (Sidebar status says `"29 cases shown"` at `GuidedBriefings.jsx:216` while displaying 6 cards above `"Show 6 more cases"`). |
| `?view=nexus&actor=Europe` (Focus Nexus) | **Pass (0 Three.js)** | `threeLoadedInFocus = false`; focuses `"European Union and United Kingdom"`. Lowercase `?actor=europe` falls back to `"United States"` (**F-22**). `CyberActors` shows `"Current cases (0)"` and hides `"Open guided briefing"`. |
| Opt-in Advanced 3D Nexus | **Loads on demand; data/perf bugs** | Clicking `"3D NETWORK (OPTIONAL)"` loads `GlobalRelationsNexus.jsx` + `three` (`canvasCount3D = 1`) and fires browser GDELT fetches (`api.gdeltproject.org`); returning to `"FOCUS VIEW"` restores `?view=nexus&actor=Europe`. Contains 5 slipped timelines (**F-06**) and force/audio bugs (**F-07**). |
| Editorial Cases Globe Layer | **Pass** | Pill toggles `"◆ EDITORIAL CASES 29 ON"` <-> `"OFF"`, showing/hiding purple editorial cylinders and multi-point arcs. |
| Intelligence Feed & `'24` Archive | **Pass (degraded dev banner)** | Search, category dropdown, and `'24` button (`"📅 2024 ARCHIVE"`, `"30 EVENTS • SOURCED"`) work; bare `vite` returns HTML for `/.netlify/functions/public-intel`, displaying `"⚠ CURRENT FEED UNAVAILABLE · 56 PUBLIC SOURCES"` (**F-18**). |
| Detail Modal + Deep Scan + AI Brief | **2 bugs** | Active `.theory-btn.active` (`REALISM`) is black-on-navy `1.31:1` (**F-03**); clicking `"🔥 FIRECRAWL + AI BRIEF"` while signed out shows generic `"⚠ Deep scan unavailable"` (**F-05**). |
| Auth Modal (`src/AuthModal.jsx`) | **A11y/focus bugs** | Opens when Supabase env vars are configured; `Escape` closes, **Tab focus escapes behind modal** (`focusEscapedAuthModal: true`), `#gcc-auth-email` lacks `<label>`, and close `×` is `9.3×16px` at `2.26:1` contrast (**F-10**, **F-24**). |
| `teacher-guide.html` | **Dev OK; Prod Broken** | `200 OK` in `vite` dev with 7/7 PNGs (`12.7 MB`) loaded, including obsolete `feature-student-pin.png`, **but omitted from `dist/`** (**F-02**). |

---

### 3.3 Netlify Functions Review (`netlify/functions/`)

| Function | Auth & Rate Limit (`security.js`) | Env Vars Read | Error Handling, CORS & Dead Code |
|---|---|---|---|
| `ai-summary.js` (`205L`) | `protectEndpoint` (`maxRequests: 12` / 15m shared Map) | `GEMINI_API_KEY`, `GEMINI_SUMMARY_MODEL` | **F-01** (`2026-12-01` `gemini-3.5-flash-lite` auto-routing, deprecated `temperature` & `thinkingBudget` -> `thinkingLevel` migration, `?key=` in URL, `SYSTEM_PROMPT` in `user` role, empty/`SAFETY` masked as `200`), **F-08** (CORS headers only on `OPTIONS`/errors). |
| `gemini-retry.js` (`71L`) | Internal helper | None | **F-01** (`MAX_RETRIES = 2` × `15s` + backoff = `~48.4s`–`65s` worst-case exceeding Netlify `~26s` sync gateway timeout; `Retry-After` is handled at `L48-51`). |
| `deep-scan.js` (`89L`) | `protectEndpoint` (`maxRequests: 15` / 15m shared Map) | `FIRECRAWL_API_KEY` | **F-05** (`.substring(0, 2997)` breaks `ai-summary.js` `12,000`-char preservation), **F-08** (CORS only on `OPTIONS`/errors), **F-09** (allows `http:`, array coercion, DNS rebinding). |
| `fetch-news.js` (`231L`) | `protectEndpoint` (`maxRequests: 20` / 15m shared Map) | `SERPER_API_KEY`, `GOOGLE_NL_API_KEY` | **F-08** (missing `Cache-Control: private, no-store` and CORS on `200`), **F-26** (`stale: true` when cache empty). |
| `security.js` (`145L`) | Shared auth/CORS/rate-limit module | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_ANON_KEY`, `ALLOWED_ORIGINS` | **F-08** (`responseHeaders` not exported for `200` responses), **F-09** (`/auth/v1/user` fetch at `L98` has no timeout and runs before `rateLimit` at `L117`; single shared `requestBuckets` Map). |
| `public-intel.mjs` (`61L`) | `protectPublicEndpoint` (`GET`, CDN cached) | `SERPER_API_KEY` (via `_shared/intel-snapshot.js`) | **F-04** (`minerals: {}` hardcoded). Graceful stale/degraded fallback works well. |
| `refresh-public-intel.mjs` (`14L`) | Netlify Scheduled Function (`netlify.toml`) | `SERPER_API_KEY` (via `_shared/intel-snapshot.js`) | Clean scheduled snapshot writer (`public-intel/current.json`). |
| `source-health.mjs` (`46L`) | `protectPublicEndpoint` (`GET`, Blobs read) | None | Clean Blobs read fallback when unconfigured. |
| `refresh-source-health.mjs` (`28L`) | Netlify Scheduled Function (`netlify.toml`) | None | **F-13** (`_shared/source-health.js:1` `CHECK_TIMEOUT_MS = 3000` aborts `103/106` URLs on cold parallel TLS; won't scale to 129 cases within 30s scheduled limit without Background Function conversion). |
| `fetch-intel.js` (`591L`) | `protectEndpoint` (`GET`, `maxRequests: 30` at `L4,396`) | `SERPER_API_KEY`, `GNEWS_API_KEY` | **F-04 / F-17 / F-19**: Authenticated (`L396`), but completely orphaned from the UI since `public-intel.mjs` replaced it (and sole reader of `GNEWS_API_KEY` at `L413`). Retire along with `netlify/functions/__tests__/fetch-intel.node.test.js:4`. |

---

### 3.4 Lighthouse Desktop & Mid-Range Mobile Audit (`docs/audit-evidence/lighthouse-audit-results.json`)

| Route | Profile | Perf | A11y | Best Practices | FCP | LCP | TBT | CLS | Speed Index | Three.js Loaded? |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| `?view=globe` | Desktop | **59** | **96** | **96** | `1.2s` | `1.2s` | `760ms` | `0.009` | `4.0s` | **Yes** (`earth-night.jpg` `715.6 KB`, `night-sky.png` `568.4 KB`) |
| `?view=globe` | Mobile | **33** | **96** | **96** | `2.5s` | **`48.6s`** | **`2,450ms`** | `0.004` | `15.4s` | **Yes** (heavy WebGL main-thread `6.8s`) |
| `?view=briefings&tour=tuvalu-australia-falepili-union&step=3` | Desktop | **73** | **97** | **96** | `1.1s` | `4.6s` | `0ms` | `0.024` | `1.6s` | **No (`0` requests)** |
| `?view=briefings&tour=tuvalu-australia-falepili-union&step=3` | Mobile | **94** | **96** | **96** | `2.0s` | `2.0s` | `30ms` | `0` | `5.0s` | **No (`0` requests)** |
| `?view=nexus&actor=Europe` | Desktop | **72** | **96** | **96** | `1.1s` | `4.5s` | `0ms` | `0.005` | `2.0s` | **No (`0` requests)** |
| `?view=nexus&actor=Europe` | Mobile | **73** | **96** | **96** | `1.6s` | `25.7s` | `110ms` | `0` | `1.6s` | **No (`0` requests)** |

---

### 3.5 Runtime Third-Party URLs Inventory

| Runtime URL | Initiator (`file:line`) | Observed Status | Local Bundling Action |
|---|---|---|---|
| `https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json` | `src/App.jsx:322` | `200 OK` | Bundle in `public/data/countries-110m.json`. |
| `https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson` | `src/App.jsx:336` (fallback) | **Blocked by CSP** (`netlify.toml:21`) | Remove external fallback once `countries-110m.json` is local (or add to `connect-src`). |
| `https://unpkg.com/three-globe/example/img/earth-night.jpg` | `src/App.jsx:307` | `302` -> `@2.45.6` (`715.6 KB`) | Bundle compressed WebP/JPG in `public/textures/earth-night.jpg`. |
| `https://unpkg.com/three-globe/example/img/night-sky.png` | `src/App.jsx:308` | `302` -> `@2.45.6` (`568.4 KB`) | Bundle compressed WebP/PNG in `public/textures/night-sky.png`. |
| `https://fonts.googleapis.com/css2?family=Orbitron...&family=Roboto+Mono...` | `index.html:9-11` | `200 OK` (render-blocking) | Self-host `woff2` subsets in `public/fonts/` or preload non-blocking. |
| `https://www.netlify.com/img/global/badges/netlify-color-accent.svg` | `src/App.jsx:1882` | `301` -> `/assets/badges/...` | Bundle SVG in `public/assets/netlify-badge-color-accent.svg` with `width`/`height`. |
| `https://api.gdeltproject.org/api/v2/doc/doc?...` | `src/nexusGDELT.js:61` | `200` / rate-limited | Proxy and cache server-side via a Netlify Function + Blobs. |

---

### 3.6 Supabase Review & Unverified RLS / Schema Assumptions

Inspected `src/supabase.js:1-38`, `src/auth.css:1-212`, `src/AuthModal.jsx:1-131`, `src/App.jsx:231-296`, and `docs/SUPABASE.md:1-9`. Because **zero SQL migration or RLS policy files exist in the repository** (`docs/SUPABASE.md` is 9 lines of high-level prose), the frontend makes **7 unverified database/auth assumptions** against `public.user_data`:

1. **`SELECT` RLS (`auth.uid() = user_id`)**: `src/App.jsx:254-256` queries `.from('user_data').select('value').eq('user_id', user.id).eq('key', 'gcc-preferences')`, assuming RLS blocks authenticated users from omitting `.eq('user_id', ...)` to read other users' rows.
2. **`INSERT` RLS `WITH CHECK (auth.uid() = user_id)`**: `src/App.jsx:292-295` sends client-supplied `user_id: user.id` in `.upsert({ user_id: user.id, key: 'gcc-preferences', value: prefs }, { onConflict: 'user_id,key' })`, assuming RLS blocks forging another `user_id`.
3. **`UPDATE` RLS `USING` + `WITH CHECK`**: `.upsert(..., { onConflict: 'user_id,key' })` requires **both** `INSERT` and `UPDATE` policies with matching `USING` and `WITH CHECK (auth.uid() = user_id)` clauses.
4. **`anon` Role Revocation**: Client code assumes `anon` cannot read or write `public.user_data` using `VITE_SUPABASE_PUBLISHABLE_KEY`.
5. **Composite Unique / Primary Key on `(user_id, key)`**: `.upsert(..., { onConflict: 'user_id,key' })` (`src/App.jsx:294`) fails with Postgres `42P10` unless `(user_id, key)` has a `PRIMARY KEY` or `UNIQUE` constraint.
6. **JSONB Value Size & Key Allowlist Constraint**: `value` accepts arbitrary JSON (`src/App.jsx:279-295`) with no verified `CHECK (pg_column_size(value) <= 16384)` or `key` length check.
7. **Auth Redirect URL Allowlist**: `src/AuthModal.jsx:64` passes `emailRedirectTo: window.location.href` (including query parameters like `?view=briefings&tour=...`), which requires wildcard redirect allowlisting (`https://<domain>/**`) in Supabase Auth settings.

---

## 4. Phase 2 Code Quality, Decomposition & Test Strategy

### 4.1 Low-Risk Decomposition Plan for `src/App.jsx` (`2,339` lines -> `~180` lines)

Extract in 5 incremental commits, adding/running protecting tests (`npm test && npm run build`) before and after each step:

| Step | Target Module(s) | Exact Source Lines in `src/App.jsx` | Responsibility Extracted | Protecting Tests (Existing + New) |
|---|---|---|---|---|
| **A1** | `src/navigationState.mjs` + `src/data/theoryKeywords.mjs` | `L26,36-50` (`VIEW_MODES`, `getViewFromLocation`, `getBriefingEntryFromLocation`), `L730-755` (`THEORY_KEYWORDS`, `THEORY_COLORS`), delete dead `COORDS` (`L644-672`) | Pure URL route/actor parsing (with case-insensitive `actor` resolution) and IR theory lens maps (`0` React dependencies). | New `src/__tests__/navigationState.node.test.mjs`. |
| **A2** | `src/hooks/useUserPreferences.js` | `L231-296` (local + Supabase `user_data` hydration & persistence) | LocalStorage + Supabase `(user_id, key, value)` sync with `.maybeSingle()` fix and `400ms` upsert debounce. | `localState.node.test.mjs` + new mock Supabase `.maybeSingle()` & debounce test. |
| **A3** | `src/hooks/useIntelFeed.js` | `L128-169`, `L430-728`, + `useMemo` feed filter decoupled from `L803-815` | Public snapshot fetch, CSV/editorial merge, live news scan, `filteredForecasts` derived via `useMemo` (fixing **F-11**), and Deep Scan + AI Brief state machine. | `intelFeed.node.test.mjs`, `public-intel.node.test.js` + **New Test #2** (Feed filter independence without WebGL globe). |
| **A4** | `src/components/AppHeader.jsx`, `OperationalDashboard.jsx`, `AppFooter.jsx` | `L1090-1284` (Header), `L1680-1838` (Dashboard/Escalation), `L1839-1895` (Footer) | Top command bar (with 3-column CSS Grid fix), operational telemetry drawer, and attribution footer. | Smoke render test via Vite `createServer().ssrLoadModule` (`src/__tests__/contentIntegrity.node.test.mjs:30`) + `react-dom/server` `renderToStaticMarkup` (zero new test deps). |
| **A5** | `src/components/GlobeViewport.jsx`, `IntelSidebar.jsx`, `ForecastDetailModal.jsx` | `L299-425`, `L803-1055`, `L1289-1675`, `L1898-2334` | Lazy `globe.gl` wrapper (pausing rAF when hidden), `<article>` Intel Feed list, Detail Modal, and Critical Minerals Modal. | `ForecastDetailModal` dialog/unauth Deep Scan SSR markup test via `vite.ssrLoadModule`. |

---

### 4.2 Low-Risk Decomposition Plan for `src/GlobalRelationsNexus.jsx` (`1,779` lines -> `~240` lines)

| Step | Target Module(s) | Exact Source Lines in `src/GlobalRelationsNexus.jsx` | Responsibility Extracted | Protecting Tests (Existing + New) |
|---|---|---|---|---|
| **N1** | Prune Unrendered Handlers & Dead Imports | `L8` (`nexusNarrative.js`), `L216,866-903` (`contextMenu` trap), `L198,625` (`window._lastClickShift`) | Remove right-click `event.preventDefault()` trap (`L867`), unused `nexusNarrative.js` import (`L8`), and undocumented `window._lastClickShift` global. | `npm run build` + `graphReadiness.node.test.js`. |
| **N2** | `src/data/nexusGraphModel.mjs` | `L14-162` (`PRIMARY_ANCHORS` unified with `NEXUS_ACTORS`, fixed `GPC_NODE_MAP`/`GPC_CONTEXT`, `assignPrimaryAnchor`), `L273-520` (graph builder) | Pure graph node/link construction and GPC concept mapping aligned with `MilitantPMC`, `UN_OPEC`, and `BiotechHub`. | **New Test #3** (`nexusReferentialIntegrity.node.test.mjs`). |
| **N3** | `src/hooks/useNexusSimulation.js` | `L550-655`, `L999-1085` | Force-graph lifecycle, `useEffect` theory force/audio transitions (fixing `L565-601`), Three.js mesh cache with `.dispose()` cleanup, and `NexusAudio` teardown. | `graphReadiness.node.test.js` + pure `.mjs` disposal helper unit test. |
| **N4** | `src/components/nexus/NexusHudPanel.jsx` + `NexusInspectorDrawer.jsx` | `L1180-1520` (HUD tabs/filters/actors), `L1522-1774` (right inspector drawer + fixed `L951-962` arrow cycling) | Accessible left control HUD and right actor/edge inspector drawer. | Static markup/ARIA role test via `vite.ssrLoadModule` + `renderToStaticMarkup`. |

---

### 4.3 Dead Files, Duplicated Logic, Naming, Prop Drilling & Derived State

- **Dead / Duplicate Files to Remove (`~0.4 MB` total):**
  1. `netlify/functions/fetch-intel.js` (`22 KB` — orphaned authenticated Serper/GNews function superseded by `public-intel.mjs`; retire together with `netlify/functions/__tests__/fetch-intel.node.test.js` and `GNEWS_API_KEY` in `.env.example:12` / `docs/ENVIRONMENT.md:15`)
  2. *(Retained per `2026-11-17` owner correction)* `public/context-cards/` (`index.html` + 5 Republican China `.jpg` portraits) is a live, self-contained teaching page at `/context-cards/` and is kept in `public/` with self-hosted `Playfair Display` WOFF2 fonts and automated asset/link-health checks.
  3. `src/GlobalRelationsNexus.jsx.backup` (`100 KB`) & `src/GlobalRelationsNexus.jsx.full` (`96 KB`)
  4. Root `Global_Forecasts_2026_Enriched.csv` (`70 KB` — exact duplicate of `public/Global_Forecasts_2026_Enriched.csv`)
  5. `deno.lock` (`24 B`), `public/news_brief.json` (`1.6 KB`), `src/nexusNarrative.js` (`6.8 KB`), and dead `COORDS`/`inferCoords`/`inferCategory` (`src/App.jsx:644-672`).
- **Derived State Stored in `useState` (Anti-Patterns):**
  - `filteredForecasts` (`src/App.jsx:129,807-815`): derived strictly from `(forecasts, historicalData, selectedCategory, timelineYear, globeNewsOnly)` via `filterIntelForecasts` — storing it in `useState` inside `updateGlobeData` caused **F-11**. Convert to `useMemo`.
- **Naming Inconsistencies & Prop Drilling:**
  - Curated case studies map into legacy CSV PascalCase keys (`Broad_Category`, `Entity/Subject`, `Expected Impact/Value`) via `toForecastRecord` (`src/App.jsx:10,27`) while `GuidedBriefings.jsx` and `NexusFocusView.jsx` read camelCase fields.
  - CSS class `.theory-btn` is defined twice in `src/App.css` (`L1654` vs `L2880`) for two unrelated widgets, causing **F-03**.

---

### 4.4 Test Suite Review & Top 3 Risk-Reducing Tests to Add

#### Current Coverage (`10` files, `38` tests, `0` DOM/React component mounts)
- **`src/__tests__/` (5 files, matched via `src/__tests__/*.node.test.*`)**:
  - `contentIntegrity.node.test.mjs`: Validates 29 case schemas, `NEXUS_ACTORS` IDs, source counts, and manifest sync — **note:** `L84` compares `reviewBy >= EDITORIAL_SNAPSHOT_DATE` (`2026-08-10`) rather than wall-clock date (so 29/29 overdue cases pass silently), and it does not validate `EDGE_DESCRIPTIONS` timelines or `GPC_NODE_MAP` actor IDs.
  - `graphReadiness.node.test.js`: Tests `graphReadiness.mjs` helper flags — **does not** test `GlobalRelationsNexus.jsx` force callbacks or cleanup.
  - `intelFeed.node.test.mjs`: Tests `intelFeed.mjs` sorting/filtering/status helpers — **does not** test `App.jsx`'s `updateGlobeData` coupling or Deep Scan error states.
  - `localState.node.test.mjs`: Tests `localState.mjs` safe `localStorage` JSON fallback — **does not** test Supabase `.maybeSingle()` or upsert debouncing.
  - `sourceHealth.node.test.mjs`: Tests `sourceHealth.mjs` primary/alternate source selection — URL route parsing (`App.jsx:36-50,134,223`) has **zero** unit tests.
- **`netlify/functions/__tests__/` (5 files, matched strictly via `netlify/functions/__tests__/*.node.test.js`)**:
  - `ai-summary.node.test.js`: Tests `selectArticleContent` and `sanitizeBrief` — **does not** test `gemini-3.5-flash-lite` `thinkingLevel` compatibility, `x-goog-api-key` header usage, `SAFETY` block handling, or `deep-scan.js` -> `ai-summary.js` 12k char passthrough.
  - `fetch-intel.node.test.js`: Tests **orphaned** `fetch-intel.js` (`L4`), whereas active `fetch-news.js` and `deep-scan.js` have **zero** dedicated tests.
  - `public-intel.node.test.js`, `security.node.test.js`, `source-health.node.test.js`: Cover happy-path normalization and basic `401`/`403`/rate-limit checks, **missing** cross-endpoint rate-limit isolation and `/auth/v1/user` timeout tests.

#### Top 3 Highest-Value New Tests to Add First
1. **`netlify/functions/__tests__/deep-scan-and-gemini.node.test.js`** *(must use `.node.test.js` extension to match `package.json:28`)*:
   - Tests `deep-scan.js` against `http://`, non-string `{"url":["..."]}`, private/rebinding hosts, and `>12,000`-char markdown preservation into `ai-summary.js`, asserts `ai-summary.js` sends `x-goog-api-key`, `systemInstruction`, and model-appropriate thinking config within a `<22s` retry ceiling, and verifies every non-scheduled handler in `netlify/functions/` invokes `protectEndpoint` or `protectPublicEndpoint`.
2. **`src/__tests__/intelFeedAndNavigation.node.test.mjs`**:
   - Verifies feed filtering operates with `globeEl.current = null`, covers `?view=`/`?tour=`/`?step=` and case-insensitive `?actor=` resolution, and verifies signed-out Deep Scan surfaces an explicit sign-in prompt.
3. **`src/__tests__/nexusReferentialIntegrity.node.test.mjs`**:
   - Asserts every actor ID in `GPC_NODE_MAP`, `GPC_CONTEXT`, `PRIMARY_ANCHORS`, and `EDGE_DESCRIPTIONS` exists in canonical `NEXUS_ACTORS`, and that every `EDGE_DESCRIPTIONS` `timeline` references at least one of its own edge actors/regions (preventing **F-06** and **F-07**).
