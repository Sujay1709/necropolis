# Necropolis

**Every repo is haunted. Necropolis finds the hauntings and exorcises them with Kiro.**

A Kiroween 2026 entry in the **Skeleton Crew** category: one small core engine, two distinct apps built on it.

| | |
|---|---|
| **Core** (`core/`) | `Analyzer -> Haunting -> score -> specWriter`. Knows nothing about UIs or Crew. |
| **Graveyard** (`apps/graveyard/`) | Static web app. Tombstone map of *cursed files* (churn, bug-fix share, low coverage). Click a tombstone, get a Kiro bugfix spec. |
| **Exorcist** (`apps/exorcist/`) | Kiro Crew app + CLI. Audits a `.kiro/` folder, gives a *haunting score*, writes the fix as a Kiro feature spec. |

## 60-second judge path

```bash
git clone <this repo> && cd necropolis
npm install
npm test                 # repo checks + core + apps
npm run sample-repo      # builds examples/sample-repo/out: a demo git repo with a haunted .kiro/
```

Then (once Phases 3 and 4 land):

```bash
npm -w apps/graveyard run dev      # open the map on examples/sample-repo/out
npx necropolis exorcist scan examples/sample-repo/out/.kiro   # haunting score for the demo repo
```

## Status (honest)

| Piece | State | How to verify |
|---|---|---|
| Kiro setup: steering, hooks, custom agents | **Done** (Phase 0) | `npm test` runs `tests/kiro-config.test.ts` against the verified formats in `docs/kiro-verification.md` |
| Core engine spec | **Done** (Phase 1) | `.kiro/specs/core-engine/`; `tests/spec-structure.test.ts` checks EARS form and task/requirement links |
| Sample repo generator | **Done** | `npm run sample-repo`; `tests/sample-repo.test.ts` |
| Core engine implementation | Not started (Phase 2, Kiro executes `tasks.md`) | — |
| Graveyard | Not started (Phase 3) | — |
| Exorcist | Not started (Phase 4) | — |
| MCP server | Optional, last | — |

Nothing in this repo fakes output. If a row says "Not started", there is no code for it.

## How this project uses Kiro

- **Steering** (`.kiro/steering/`): `product.md`, `tech.md`, `structure.md` always on; `haunting-schema.md` loads only for `core/**`, `apps/**`, `mcp/**` TypeScript via `fileMatch`.
- **Specs** (`.kiro/specs/`): one per subsystem. `core-engine` is requirements-first with EARS criteria, a design with the scoring formula, and ten ordered tasks, two of them property-based tests.
- **Hooks** (`.kiro/hooks/`): `PostFileSave` on `core/src/analyzers/*.ts` checks registration and tests; `Stop` offers to run the suite, with a `confirmCommand` that skips the prompt when no code changed.
- **Custom agents** (`.kiro/agents/`): `spec-writer` (write access limited to `.kiro/specs/**` via `permissions.rules`) and `reviewer` (read-only, can run `npm test`).
- **Crew**: Exorcist ships as a Crew app (`app.json`, agents, skills, a scheduled scan).
- **Facts, not guesses**: every Kiro format used here is listed with its doc URL in `docs/kiro-verification.md`. Unverified facts can only produce warnings in Exorcist.

## Development

```bash
npm install
npm test               # everything
npm run typecheck      # tsc on core
npm run sample-repo    # regenerate the demo repo (gitignored)
```

Node 22+. No other runtime. See `.kiro/steering/tech.md` for the rules.

## License

MIT. See `LICENSE`.
