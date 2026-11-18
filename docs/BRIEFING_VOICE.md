# Guided Briefing Voice & Style Guide (Content Depth Standard v2)

This guide translates the teaching voice of the IB Global Politics reference pack into the Global Command Center's sourced briefing architecture. Pass this file to Claude with every drafting and review call in Phase C4.

## Core Analytical Spine

Every deepened briefing answers the same three-part question without taking a political side:

> *Who holds the legal right to decide, how did another actor shape their choices, and what actually changed in people's daily lives?*

1. **Authority vs. lever:** Separate formal lawmaking or treaty power from economic leverage, diplomacy, street mobilization, courts, or armed force.
2. **The mechanism:** Trace how pressure changed the cost of saying "no" (named actors, dates, legal rulings, ports, subsidies, or vetoes).
3. **Lived reality vs. rules on paper:** Distinguish an announcement, treaty text, or court ruling from what changed on the ground for ordinary people.

## Unit 1 Core Concepts (Student Definitions)

Use only the concepts that genuinely apply to a case; never force a fourth one.

- **Power:** The ability to make something happen, narrow another actor's affordable choices, or resist pressure. Ask: *What concrete resource did each side control, and how did using it raise the cost of saying "no"?*
- **Sovereignty:** A national government's legal right to rule its territory (*de jure*) versus its practical control over people, borders, ports, and institutions (*de facto*). Ask: *Who held authority on paper, and who controlled ground reality?*
- **Legitimacy:** Why citizens or outside actors accept a rule, ruler, or institution as rightful rather than mere force (procedures and representation vs. tangible results). Ask: *Who accepted this claim as rightful, on what basis, and whose consent was left out?*
- **Interdependence:** How states and communities rely on shared trade routes, ecosystems, diplomacy, and institutions across borders. Ask: *Why could no single government settle or contain this dispute inside its own borders?*

## Six Rules of the Voice

1. **Open with a concrete scene and real people.** Start `background` on a street, port, border, court chamber, or desert camp—not an abstraction. *(Model: "The day before Rana Plaza fell, sewing-machine operators noticed deep cracks in its concrete walls." / "A giant container ship leaves Asia for Europe carrying sneakers, electronics, grain or fuel.")*
2. **Write plain English for a reader with zero background in law, diplomacy, or economics.** Explain every technical mechanism in one crisp sentence the first time it appears *(e.g., "Arbitration works like a private court..." or "A UN advisory opinion carries legal weight before states, though it has no army or police to enforce it")*. Spell out every abbreviation at first use, like `African Union (AU)` or `United Nations Security Council (UNSC)`.
3. **Be concrete, dated, and agent-specific.** Name the actor, date, verified figure, and actual lever. Avoid vague passive constructions ("tensions rose", "concerns were voiced") when a dated source names who acted or argued what.
4. **Let clean transitions carry the logic.** Connect claims with cause-and-effect bridges *(e.g., "A contract only matters if someone can enforce it, and the unions soon did.")*.
5. **Short sentences, active voice, zero filler.** Cut empty throat-clearing: never write *"plays a crucial role"*, *"in today's complex world"*, *"it is important to note"*, *"underscores the complexity"*, or *"remains a key flashpoint"*.
6. **Strict attribution and neutrality always outrank fluency.** Every factual sentence must trace to a verified `sources` or `supplementalSources` URL in that case. Contested positions must be attributed and dated (`"[Actor] maintains..."`, `"According to [Source] (date)..."`); never state a contested claim as established fact. Keep `debate` free of any editorial verdict, label `influenceCheck` ratings explicitly as an editorial assessment, and keep any direct quotation at **25 words or fewer**, attributed and linked.

## Section Blueprint & Budgets (v2)

- **Waypoint `narration` (`4–5` steps):** **90–160 words** split into **two short paragraphs** separated by a blank line (`\n\n`).
  - *Paragraph 1:* What this perspective holds, attributed and dated to a case source.
  - *Paragraph 2:* What that shows analytically and how it connects to the step's `focusQuestion` and core concept.
- **`background`:** **120–200 words** tracing how the present standoff developed from key turning points, opening with a concrete scene and sourced dates.
- **`keyTerms` (`3–6` entries):** `{ term, definition, sourceUrl }` written in one or two plain-English sentences; prefer institutional sources when defining legal terms, treaties, or statuses.
- **`debate` (`2–3` pairs):** `{ claim, counterClaim, claimBy, counterBy, sourceUrls }` contrasting two real, attributed positions without deciding between them.
- **`watchFor` (`2–4` entries):** `{ date, indicator, sourceUrl }` citing scheduled events, mandates, summits, court deadlines, or formal reviews—observable indicators only, never predictions.
- **`examPrompts` (`2` prompts):** Analytical IB Global Politics Paper 2 questions using command terms (`Discuss`, `Evaluate`, `To what extent...`, `Examine`, `Compare and contrast`); original phrasing, never copied past-paper questions.
- **`influenceCheck` (`3` stages):** `Setting the agenda`, `The formal decision`, and `What changed in practice`, each with `rating` (`STRONG` | `MIXED` | `WEAK`), `1–2` sourced sentences of `evidence`, and matching `sourceUrls`. Always presented as an editorial assessment, not a source fact.
- **`conceptLens`:** Plain-English `1–2`-sentence entries under `{ power, sovereignty, legitimacy, interdependence }`. Leave out any concept that does not genuinely illuminate the case.
- **`essayBuilder`:** One worked 4-step Paper 2 paragraph (`prompt`, `claim`, `evidence`, `counterClaim`, `judgment`, `sourceUrls`) answering one `examPrompts` item with verified evidence and an explicit boundary condition (*"However,..."* / *"On balance,..."*).
- **Tier 2 teaching metadata:** `timeline` (`3–6` dated events `{ date, label, sourceUrl }`—never substituting source publication date for event date unless reporting that day's event), `keyFigures` (`0–3` exact figures already present in `statusSummary` or `uncertainty`), `concepts` (`Power`, `Sovereignty`, `Legitimacy`, `Interdependence`), and `ibThemes` (canonical guide themes).
