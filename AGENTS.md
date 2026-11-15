# Agent Instructions

When AI agents are interacting with this repository, they should adhere to the following guidelines:

1. **Tech Stack**: Use React 18, Vite 5, Node.js 22.
2. **Commit Style**: Follow Conventional Commits format (`feat:`, `fix:`, `docs:`, etc.).
3. **Environment**: Distinguish between `VITE_` prefixed vars (client) and server-side vars (Netlify functions).
4. **Documentation**: Update docs in `/docs` when changing architecture or environment variables.
5. **Issues**: Check `docs/KNOWN_ISSUES.md` before starting new feature development.

## Working with other agents

Three agents work on this project: Antigravity, Claude Code and Codex. All three read this file (Claude through `CLAUDE.md`).

- Antigravity is the lead unless the owner says otherwise. It edits files, runs the app and the tests on the desktop, and asks Claude Code or Codex for a read-only review before it finishes a task.
- Claude Code and Codex are reviewers. They return their feedback as text and edit nothing, including `HANDOFF.md`. If the owner gives one of them a task directly, it is the lead for that task and the same rules apply.
- Before starting, the lead reads `HANDOFF.md`. Before stopping, it adds an entry: what it did, what it tested and how, what is unfinished, what the next agent should check.
- Each agent can be asked for a review from the terminal (run from the project root; the commands are launchers in `~/.local/bin`):
  - Claude: `claude -p "<prompt>" < /dev/null`
  - Codex: `codex exec --sandbox read-only "<prompt>"`
  - Antigravity: `agy -p "<prompt>"`
