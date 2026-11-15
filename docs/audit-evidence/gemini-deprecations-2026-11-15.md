# Verbatim Google Gemini API Deprecation & Migration Excerpts (Captured 2026-11-15)

Captured on `2026-11-15` via `curl -sL https://ai.google.dev/gemini-api/docs/deprecations` and `curl -sL https://ai.google.dev/gemini-api/docs/whats-new-gemini-3.6` (note: both URLs `301`-redirect to `https://aistudio.google.com/docs/...`, which serves raw Markdown with `{% callout %}` / `{% table %}` tags and an `> ## AI Agent Context` banner when fetched with a non-browser `curl/*` `User-Agent`) to substantiate Finding **F-01** (`netlify/functions/ai-summary.js:8,150,155`).

Response preamble returned by `https://ai.google.dev/gemini-api/docs/deprecations`:
```text
> ## AI Agent Context
> Get the complete documentation index at: https://aistudio.google.com/llms.txt
> Use this file to discover all available pages.
> For the full documentation in a single file, fetch: https://aistudio.google.com/llms-full.txt
```

---

## 1. Source: `https://ai.google.dev/gemini-api/docs/deprecations#gemini-2.5-flash-models`

Verbatim excerpt from `## Gemini 2.5 Flash models`:

```text
## Gemini 2.5 Flash models  {% id="gemini-2.5-flash-models" %}

{% callout type="caution" %}
  `gemini-2.5-flash` is deprecated and is no longer available to select in Google
  AI Studio. Effective December 1, 2026, all API requests to `gemini-2.5-flash`
  will automatically route to
  [`gemini-3.5-flash-lite`](/docs/models/gemini-3.5-flash-lite) and be billed at
  [Gemini 3.5 Flash-Lite rates](/docs/pricing#gemini-3.5-flash-lite). Review the
  breaking API changes in the
  [Gemini 3.5 Flash-Lite migration guide](/docs/whats-new-gemini-3.6#migrate-to-gemini-3-5-flash-lite)
  before December 1, 2026. Access to the 2.5 models is limited to users who have
  actively used them in the past. `gemini-2.5-flash-lite` is not deprecated and
  remains available through the API until further notice.
{% /callout %}

Model: gemini-2.5-flash
Release date: June 17, 2025
Shutdown date: December 1, 2026
Recommended replacement: gemini-3.5-flash-lite (`gemini-2.5-flash` is no longer available in Google AI Studio; effective December 1, 2026, API requests to `gemini-2.5-flash` will automatically route to `gemini-3.5-flash-lite`)
```

---

## 2. Source: `https://ai.google.dev/gemini-api/docs/whats-new-gemini-3.6#api-changes-and-parameter-updates`

Verbatim excerpts from `## API changes and parameter updates` and `### Migrate to gemini-3.5-flash-lite`:

```text
## API changes and parameter updates  {% id="api-changes-and-parameter-updates" %}

Starting with Gemini 3.6 Flash and Gemini 3.5 Flash-Lite, the following API changes apply to these models and all future Gemini model releases.

* Sampling parameter deprecation: `temperature`, `top_p`, and `top_k` are deprecated. The API ignores these parameters and returns an error in future model generations.
* Prefilled model turn validation: Prefilling model turns is no longer supported. If the last non-empty turn in the request is a `model` turn, the API returns a `400` error.

### 1. Sampling parameter deprecation (temperature, top_p, top_k)

`temperature`, `top_p`, and `top_k` are deprecated and ignored. In future model generations, supplying these parameters returns an HTTP 400 error. Remove these parameters from all requests.

### Migrate to gemini-3.6-flash  {% id="migrate-to-gemini-3-6-flash" %}
* Apply parameter updates: Remove deprecated sampling parameters (`temperature`, `top_p`, `top_k`), `candidate_count` (unsupported in Gemini 3 and later), and prefilled model turns...
* Configure thinking level: Replace `thinking_budget` with `thinking_level` (`"medium"` or `"high"`).

### Migrate to gemini-3.5-flash-lite  {% id="migrate-to-gemini-3-5-flash-lite" %}
* Update Model ID: Change your target model string to `gemini-3.5-flash-lite`.
* Configure thinking effort level:
  * For high-volume extraction, routing, or classification: leave `thinking_level` at `"minimal"` (default) for maximum throughput.
  * For autonomous subagents with tool calls, code execution, or multi-step reasoning: set `thinking_level` to `"medium"` or `"high"` to prevent premature tool termination.
* Remove deprecated parameters and validate function calling: Apply the same rules as 3.6 Flash (/docs/whats-new-gemini-3.6#migrate-to-gemini-3-6-flash).
```

---

## 3. Direct Impact on `netlify/functions/ai-summary.js`

1. `netlify/functions/ai-summary.js:8` defaults to `const GEMINI_MODEL = process.env.GEMINI_SUMMARY_MODEL || 'gemini-2.5-flash';`. On **2026-12-01** (`16` days after audit date `2026-11-15`), requests to `gemini-2.5-flash` automatically route to `gemini-3.5-flash-lite`.
2. `netlify/functions/ai-summary.js:150` sends `temperature: 0.3` (deprecated and ignored on `gemini-3.5-flash-lite`, slated for `400` rejection).
3. `netlify/functions/ai-summary.js:155` sends `thinkingConfig: { thinkingBudget: 0 }` (`Migrate to gemini-3.5-flash-lite` configures `thinking_level` at `"minimal"` default and cross-references the `3.6 Flash` parameter-deprecation checklist above, which states `Replace thinking_budget with thinking_level`).
