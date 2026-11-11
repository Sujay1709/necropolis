# Tech — NECROPOLIS

## Stack
- **Language:** TypeScript (strict), targeting **Node 22**.
- **Package manager / monorepo:** pnpm workspaces.
- **Testing:** Vitest. Property-based tests with **fast-check**.
- **Graveyard front end:** Vite + React + hand-written **SVG** (no heavy chart
  library). Must build to a **static site** that deploys anywhere.
- **Exorcist:** a Kiro Crew app (`app.json` + agents + skills) *and* a
  standalone CLI (`necropolis exorcist scan|exorcise`).
- **Dependencies:** prefer very few. Justify any new runtime dependency.

## Hard rules (non-negotiable)
1. **New code only. MIT licensed. Public-repo ready.** No copied code with
   incompatible licenses.
2. **`.kiro/` is committed and never gitignored.** It is judged. Steering,
   specs, hooks, and agents must show real usage, not decoration.
3. **Do not invent Kiro facts.** Never guess Kiro config formats, hook trigger
   names, agent field names, limits, or Crew `app.json` fields from memory.
   Verify against the current official docs at **kiro.dev/docs** before writing
   any `.kiro` file, hook, agent, or Crew manifest. If something can't be
   verified, say so and mark it **TODO** rather than guessing. Exorcist's rules
   depend on these facts, so a wrong guess makes the product wrong.
4. **Analyzers run fully offline.** No network calls in any analyzer. Everything
   must work on the bundled sample repo.
5. **Honest scope.** If a feature isn't working, mark it in the README. Never
   fabricate output.

## Determinism
- `score(hauntings)` is deterministic, documented, and **monotonic**: adding a
  haunting, or increasing any haunting's severity, never lowers the score.
- Analyzers must produce stable, reproducible output on the sample repo (which
  is generated with a seeded git history) so demos and tests repeat exactly.

## Verified Kiro facts (as of 2026-11-11, kiro.dev/docs)
- **Specs** live in `.kiro/specs/<name>/` as `requirements.md`, `design.md`,
  `tasks.md` (bugfix specs use `bugfix.md`). Requirements use EARS notation.
- **Standalone hooks** live in `.kiro/hooks/*.json`. Triggers are PascalCase
  (e.g. `PreToolUse`, `PostToolUse`, `SessionStart`, `PostTaskExec`). Actions
  are `{ "type": "command" | "agent", ... }`. Exit 0 → stdout added to context;
  non-zero → stderr shown and the action may be blocked.
- **Custom agents** live in `.kiro/agents/` as `.md` (YAML frontmatter + prompt
  body) or `.json`. Fields include `name`, `description`, `tools`,
  `permissions.rules`, `resources`, `model`. **Resource limit:** an agent loads
  at most **32 `file://` resource files** and **100,000 characters** total;
  a single file over **1 MiB** is skipped and over **50,000 characters** is
  truncated. (Exorcist's "over-budget" analyzer keys off these numbers.)
- **Crew app manifest** is `app.json` with `name` (kebab-case), `version`
  (semver), `displayName`, `description`, plus optional `agents`, `skills`,
  `mcpServers`, `crons`, `ui`, `permissions`.

See `.kiro/steering/structure.md` for layout rules.
