# Guided Briefing Voice & Style Guide (Content Depth Standard v2)

This guide translates the teaching voice of the IB Global Politics reference pack into the Global Command Center's sourced briefing architecture. Pass this file to Claude with every drafting and review call in Phase C4.

## Core Analytical Spine

Every deepened briefing answers the same three-part question without taking a political side:

> *Who holds the legal right to decide, how did another actor shape their choices, and what actually changed in people's daily lives?*

1. **Authority vs. lever:** Separate formal lawmaking or treaty power from economic leverage, diplomacy, street mobilization, courts, or armed force.
2. **The mechanism:** Trace how pressure changed the cost of saying "no" (named actors, dates, legal rulings, ports, insurance premiums, subsidies, or vetoes).
3. **Lived reality vs. rules on paper:** Distinguish an announcement, treaty text, or court ruling from what changed on the ground for ordinary people.

## Unit 1 Core Concepts (Student Definitions)

Use only the concepts that genuinely apply to a case; never force a fourth one.

- **Power:** The ability to make something happen, narrow another actor's affordable choices, or resist pressure. Ask: *What concrete resource did each side control, and how did using it raise the cost of saying "no"?*
- **Sovereignty:** A national government's legal right to rule its territory (*de jure*) versus its practical control over people, borders, ports, and institutions (*de facto*). Ask: *Who held authority on paper, and who controlled ground reality?*
- **Legitimacy:** Why citizens or outside actors accept a rule, ruler, or institution as rightful rather than mere force (procedures and representation vs. tangible results). Ask: *Who accepted this claim as rightful, on what basis, and whose consent was left out?*
- **Interdependence:** How states and communities rely on shared trade routes, ecosystems, diplomacy, and institutions across borders. Ask: *Why could no single government settle or contain this dispute inside its own borders?*

## Six Rules of the Voice

1. **Open Step 1 with a concrete scene, not a sourced memo.** Start Step 1 of every case on an airport tarmac, factory floor, maritime chokepoint, court chamber, or refugee camp so a student sees real places and people immediately. *(Models from the owner's reference cases: "The day before Rana Plaza fell, sewing-machine operators noticed deep cracks in its concrete walls." / "A giant container ship leaves Asia for Europe carrying sneakers, electronics, grain or fuel... The strait is only about 29 kilometers wide, which makes it a chokepoint: a narrow passage that much trade must squeeze through.")* Do not bury the concrete scene down in `background`.
2. **Write natural, plain sentences for a student with zero background.** Explain every technical or legal mechanism in one crisp sentence the first time it appears *(e.g., "Arbitration works like a private court: neutral judges outside corporate control hear the dispute, and both sides have agreed in advance that the result is binding." / "That cover pays out if a ship is hit in a conflict zone, and its price is called a premium.")*. Spell out every abbreviation at first use, like `African Union (AU)` or `United Nations Security Council (UNSC)`.
3. **Use numbered source markers `[1]`, `[2, 5]` for routine facts—never write a citation-dense memo.** Do **not** clutter prose with journalist-byline scaffolding such as *"Horn Diplomat reported…"*, *"The Council on Foreign Relations notes…"*, *"CFR adds…"*, *"UN News summarizes…"*, or parenthetical citations like *"(Al Jazeera, May 2023)"*. Move routine factual citations into small numbered markers (`[1]`, `[2]`, `[4, 10]`, indexed 1-based across `sources` followed by `supplementalSources`) that link directly to the reading list. Keep in-sentence attribution **only** for contested claims, allegations, legal interpretations, and one side's political assertions *(e.g., "Somalia's foreign ministry called the visit an 'unauthorized incursion' into its territory [10].")*.
4. **Let clean transitions and varied rhythm carry the logic.** Never let a short-sentence habit flatten a paragraph into a staccato list of separate facts. Vary sentence length: use short, direct sentences to land concrete facts, and use a longer linking sentence (keeping any single sentence to about 30 words or fewer) to trace cause and effect from one fact to the next *(e.g., "A contract only matters if someone can enforce it, and the unions soon did." / "International law and superpower force both struggled to reopen the shortcut.")*. End each step on its analytical point, written as a natural closing sentence rather than a punchy slogan.
5. **Split overloaded clauses, keep active voice, cut filler, and name the state for contested capitals.** When a sentence packs three competing actors and a dash-heavy aside into one breath, split it into clear steps while preserving flow. Use active voice and plain vocabulary. Cut empty throat-clearing: never write *"plays a crucial role"*, *"in today's complex world"*, *"it is important to note"*, *"underscores the complexity"*, or *"remains a key flashpoint"*. When referring to a state's embassy or government seat in an internationally contested capital (such as Jerusalem / West Jerusalem), name the state (`in Israel`), not the contested city.
6. **Strict sourcing and neutrality never relax.** Every factual sentence must still trace to a verified `sources` or `supplementalSources` URL via its `[n]` marker or section `sourceUrls`. Keep `debate` free of any editorial verdict, label `influenceCheck` ratings explicitly as an editorial assessment, and keep any direct quotation at **25 words or fewer**, attributed and linked.

## Section Blueprint & Budgets (v2)

- **Waypoint `narration` (`4–5` steps):** **90–160 words** (excluding `[n]` markers) split into **two short paragraphs** separated by a blank line (`\n\n`).
  - *Paragraph 1:* Opens Step 1 with the concrete scene; in every step, states what happened and what this perspective holds in plain prose with `[n]` markers (attributing contested claims in-sentence).
  - *Paragraph 2:* Explains the mechanism and analytical takeaway connected to the step's `focusQuestion` and `conceptInFocus`.
- **`background`:** **120–200 words** (excluding `[n]` markers) split into **2–3 short paragraphs** (`\n\n`) tracing the historical turning points behind the current dispute, with `[n]` markers and `backgroundSources`.
- **`keyTerms` (`3–6` entries):** `{ term, definition, sourceUrl }` written in one or two plain-English sentences; prefer institutional sources when defining legal terms, treaties, or statuses.
- **`debate` (`2–3` pairs):** `{ claim, counterClaim, claimBy, counterBy, sourceUrls }` contrasting two real, attributed positions without deciding between them.
- **`watchFor` (`2–4` entries):** `{ date, indicator, sourceUrl }` citing scheduled events, mandates, summits, court deadlines, or formal reviews—observable indicators only, never predictions.
- **`examPrompts` (`2` prompts):** Analytical IB Global Politics Paper 2 questions using command terms (`Discuss`, `Evaluate`, `To what extent...`, `Examine`, `Compare and contrast`); original phrasing, never copied past-paper questions.
- **`influenceCheck` (`3` stages):** `Setting the agenda`, `The formal decision`, and `What changed in practice`, each with `rating` (`STRONG` | `MIXED` | `WEAK`), `1–2` plain-English sourced sentences of `evidence`, and matching `sourceUrls`. Always presented as an explicit editorial assessment.
- **`conceptLens`:** Plain-English `1–2`-sentence entries under `{ power, sovereignty, legitimacy, interdependence }`. Leave out any concept that does not genuinely illuminate the case. Displayed `2×2` on desktop.
- **`essayBuilder`:** One worked 4-step Paper 2 paragraph (`prompt`, `claim`, `evidence`, `counterClaim`, `judgment`, `sourceUrls`) answering one `examPrompts` item with verified evidence and an explicit boundary condition (*"However,..."* / *"On balance,..."*).
- **Tier 2 teaching metadata:** `timeline` (`3–6` dated events `{ date, label, sourceUrl }`, with at most one event per step marked `Related to this step` via `waypoint.relatedTimelineDate`), `keyFigures` (`0–3` exact figures already present in `statusSummary` or `uncertainty`), `concepts` (`Power`, `Sovereignty`, `Legitimacy`, `Interdependence`), and `ibThemes` (`peace-and-conflict`, `rights-and-justice`, `development-and-sustainability`).

## Before and After Examples

### 1. Splitting an Overloaded Multi-Actor Clause Without Losing Flow
- **Before:** *"Western governments joined Morocco’s draft — which backed autonomy as the most feasible outcome — while Algeria rejected participation and Polisario warned any imposed formula without a referendum would collapse legitimate peace efforts."*
- **After:** *"Western governments backed Morocco’s autonomy plan as the most feasible framework for talks [4]. Algeria declined to join the table, however, and Polisario warned that no settlement without a referendum could hold [5]. Splitting the backers from the holdouts clarifies why diplomatic consensus still leaves the core dispute unresolved."*
- **Why it works:** Each actor’s move stands clearly without dash interruptions, and the third sentence links the deadlock directly to the analytical takeaway.

### 2. Fixing Choppy Fact-Lists With a Linking Bridge (Rana Plaza Model)
- **Before:** *"The brands signed a factory safety accord. Independent inspectors checked building wiring and exits. Brands promised to help pay for repairs. This changed power inside the supply chain."*
- **After:** *"After public pressure mounted, global clothing brands signed a binding safety accord that put independent inspectors inside supplier factories [1]. A contract only matters if someone can enforce it, and unions could take non-compliant buyers to arbitration when promised repairs stalled [2]. Shifting enforcement from voluntary pledges to binding rules turned workplace safety from charity into a testable obligation."*
- **Why it works:** Instead of four flat bullets, a single linking bridge (*"A contract only matters..."*) carries one clear cause-and-effect idea across 21 words before closing with a natural analytical sentence.

### 3. Replacing Memo Scaffolding and Slogan Endings
- **Before:** *"Reuters reports that container ships diverted around Africa [3]. Lloyd’s notes war-risk insurance premiums rose sharply after the strikes [4]. Combined naval patrols entered the corridor to escort vessels [5]. Chokepoints beat warships."*
- **After:** *"When drone attacks closed the shortest lane between Asia and Europe, container ships detoured thousands of miles around southern Africa at higher fuel cost [3]. Rising war-risk insurance premiums weighed heavier than naval escorts, showing how private shipping markets can restrict global trade even when states deploy warships to keep sea lanes open [4, 5]."*
- **Why it works:** Routine outlet attribution (*"Reuters reports"*, *"Lloyd’s notes"*) moves into clean `[n]` markers, and the three-word slogan at the end becomes a complete analytical sentence connecting commercial insurance to state power.
