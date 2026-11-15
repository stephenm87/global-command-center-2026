# Agent Instructions

When AI agents are interacting with this repository, they should adhere to the following guidelines:

1. **Tech Stack**: Use React 18, Vite 5, Node.js 22.
2. **Commit Style**: Follow Conventional Commits format (`feat:`, `fix:`, `docs:`, etc.).
3. **Environment**: Distinguish between `VITE_` prefixed vars (client) and server-side vars (Netlify functions).
4. **Documentation**: Update docs in `/docs` when changing architecture or environment variables.
5. **Issues**: Check `docs/KNOWN_ISSUES.md` before starting new feature development.

## Working with other agents

Three agents work on this project: Antigravity, Claude Code and Codex. All three read this file (Claude through `CLAUDE.md`).

- **Lead & Specialist Collaborator (`docs/AGENT_COLLABORATION.md`)**: Antigravity is the lead unless the owner says otherwise. Claude Code is a specialist collaborator the lead may call deliberately across five modes: read-only (`Consult`, `Second opinion`, `Review` via `--permission-mode plan`) and scoped editing (`Implement`, `Draft content` via `--permission-mode acceptEdits`, never committing, one agent editing at a time). Codex remains a read-only reviewer unless assigned a task directly by the owner.
- **Models & Cost**: For Claude Code, use `claude-fable-5-2` for visual design, hard architecture, large refactors, editorial drafting, and high-stakes second opinions; `claude-opus-5-5` as default for reviews, consults, and routine implementation; and `claude-sonnet-5-5` for quick checks (step down one level and note in `HANDOFF.md` if unavailable; stay within ~10 Claude calls per phase).
- **Handoff & Verification**: Before starting, read `HANDOFF.md` (including `Reviewer Suggestions Backlog`). Before stopping, add an entry (newest first): what was done, what was tested and how, what is unfinished, what the next agent should check, plus Claude mode, model, and `ACCEPT` / `ACCEPT-LATER` / `DISMISS` decisions. Save Claude transcripts to `review/claude-<mode>-YYYYMMDD-HHMM.md` and verify every claim or edit against source code (`npm test`, `npm run build`, `git diff`, screenshots). Case-study content requires owner sign-off.
- **Terminal Launchers (run from project root; launchers live in `~/.local/bin`; full Claude commands & briefing rules in `docs/AGENT_COLLABORATION.md`)**:
  - Claude (read-only): `claude -p --model <model> --permission-mode plan "<prompt>" < /dev/null`
  - Claude (implement/draft): `claude -p --model <model> --permission-mode acceptEdits --allowedTools "Read,Edit,Write,Bash(npm run build),Bash(npm test),Bash(git diff*),Bash(git status)" "<prompt>" < /dev/null`
  - Codex (read-only): `codex exec --sandbox read-only "<prompt>"`
  - Antigravity: `agy -p "<prompt>"`
