# Standing policy: using Claude Code as a specialist collaborator

This applies to all work in this repository until the owner changes it. It replaces the narrower "Claude reviews only" rule. Antigravity remains the lead. Claude Code is a specialist collaborator the lead may call on at its own discretion whenever it judges doing so will make the output meaningfully better. Use it deliberately, not reflexively, and not as a way to avoid thinking.

## 1. When to call Claude

Call Claude when one of these is true:
- **The stakes are high.** The change touches many files, shared state, auth, Netlify functions, or case-study data that students will rely on.
- **You are uncertain.** You have two plausible approaches and no clear winner, or you are guessing about how existing code behaves.
- **You want an independent eye.** You wrote the code or the plan yourself and need someone not anchored on your reasoning.
- **The work plays to Claude's strengths.** These are visual and interaction design, UX writing, long-form editorial and source-attribution work, careful refactoring of large files like `App.jsx` and `GlobalRelationsNexus.jsx`, writing tests, and spotting subtle correctness bugs.
- **You are stuck.** You have retried something twice and are going in circles, or you are re-reading your own logs without making progress.

Do NOT call Claude for trivial edits, lookups you can do in one command, or work you have not attempted to reason through yourself first.

## 2. Modes of collaboration

Pick the mode that fits. State which one you are using in `HANDOFF.md`.

| Mode | Use it to | Permission |
|---|---|---|
| Consult | Ask a design or architecture question before you build. Get options and a recommendation. | Read-only |
| Second opinion | Hand Claude your plan or draft and ask it to find what is wrong or missing. | Read-only |
| Review | Check a finished unit of work (code review), or check how you are working (process review). | Read-only |
| Implement | Delegate a well-scoped unit where Claude is likely to do it better, such as visual polish, UX copy, a refactor step, or a batch of tests. | Edit, no commit |
| Draft content | Have Claude draft case studies or editorial text to the repo standard, which you then verify. | Edit, no commit |

## 3. Which model to use

- **claude-fable-5-2:** the strongest model. Use it for visual design and presentation, hard architecture decisions, large refactors, editorial drafting of case studies, and any second opinion on a high-stakes plan.
- **claude-opus-5-5:** strong and quicker. Use it as the default for code reviews, process reviews, consults and routine implementation.
- **claude-sonnet-5-5:** fast. Use it for quick checks, narrow questions and small test files.

If a model is unavailable, step down one level and note it in `HANDOFF.md`.

## 4. Commands

Capture the start timestamp and use a unique temp file (`mktemp /tmp/claude.XXXXXX` — no suffix after `XXXXXX` on macOS BSD `mktemp`) so calls never overwrite `/tmp/claude-out.md` mid-run:

Read-only (consult, second opinion, review):

```bash
TS=$(date +%Y%m%d-%H%M) && TMP=$(mktemp /tmp/claude.XXXXXX) && claude -p --model <model> --permission-mode plan "<prompt>" < /dev/null > "$TMP" && mv "$TMP" "review/claude-<mode>-${TS}.md"
```

Implement or draft content:

```bash
TS=$(date +%Y%m%d-%H%M) && TMP=$(mktemp /tmp/claude.XXXXXX) && claude -p --model <model> --permission-mode acceptEdits --allowedTools "Read,Edit,Write,Bash(npm run build),Bash(npm test),Bash(git diff*),Bash(git status)" "<prompt>" < /dev/null > "$TMP" && mv "$TMP" "review/claude-implement-${TS}.md"
```

Continuing a conversation: each call starts fresh. When a follow-up depends on Claude's earlier reasoning, add `--output-format json` to the first call, save the `session_id` from the result, and pass `--resume <session_id>` on the next call. Otherwise point Claude at `HANDOFF.md` and the relevant review file.

## 5. How to brief Claude

Claude knows only what you put in the prompt and what it reads in the repo. Every prompt must include:
1. **The goal and the mode.** For example: "You are giving a second opinion, read-only."
2. **What to read first.** Always include `AGENTS.md` and `HANDOFF.md`, plus the specific files and docs that matter.
3. **What you have already tried or ruled out**, so Claude does not repeat it.
4. **Constraints.** Keep the existing design language, keep the stack fixed, never commit, and list any files that are off limits.
5. **The output you want back.** For example: ranked findings with `file:line` and `BLOCKING` / `SHOULD-FIX` / `SUGGESTION` labels, or a list of files changed with reasons.
6. **For visual work:** the paths to current screenshots in `docs/screenshots/`, because Claude cannot see the running site.

Do not hand Claude your conclusion and ask it to confirm it. Give it the code and the question, and let it reach its own view.

## 6. What to do with Claude's output

- **Treat it as expert input, not orders.** The lead decides. Every finding gets `ACCEPT`, `ACCEPT-LATER` or `DISMISS` with a reason in `HANDOFF.md`.
- **Verify before you apply.** Check each claim against the code. Claude can be wrong with confidence, just as the lead can.
- **When you disagree on something important,** ask Claude once to respond to the counter-argument using `--resume`. If disagreement remains, flag it for the owner rather than looping.
- **Feed suggestions forward.** Good ideas not acted on immediately go into the `Reviewer Suggestions Backlog` in `HANDOFF.md`. Plan each new unit by reading that backlog first.
- **After any Implement or Draft call,** the lead becomes the reviewer: take fresh screenshots, read the full `git diff`, run `npm test` and `npm run build`, and log the result.

## 7. Guardrails

- **Only one agent edits at a time.** While Claude is implementing, the lead does not touch files.
- **Claude never commits or pushes.** Work stays on a feature branch, never `main`.
- **Case-study content needs human sign-off.** Claude may draft cases, but no case is final until the owner approves it. Every source URL must be checked as reachable, and every claim must be traceable to its source.
- **Keep an eye on cost.** Every call is billed to the owner's Claude account. Use `claude-fable-5-2` only where its extra ability matters. Aim for no more than about 10 Claude calls per phase without telling the owner; if more are needed, say why.
- **If a call fails or times out,** retry once, then continue without Claude and record that the unit was not reviewed.

## 8. Reporting

At the end of each phase, report to the owner in chat:
- Each time Claude was called: the mode, the model, and in one line what changed because of it.
- Any finding dismissed and why.
- Any point where the lead and Claude still disagree.
- An honest view on whether calling Claude improved the outcome, so the policy can be tuned.
