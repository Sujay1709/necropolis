---
inclusion: always
---

# Necropolis: tech

## Stack

- **Language:** TypeScript, strict mode. ES modules only (`"type": "module"`).
- **Runtime:** Node.js 22 or newer. No other runtimes.
- **Package manager:** npm workspaces (`core`, `apps/*`, `mcp`). Do not add pnpm or yarn files.
- **Tests:** Vitest. Property-based tests use `fast-check`. Test files live in `<package>/test/**/*.test.ts` and repo-level checks in `tests/`.
- **Graveyard UI:** Vite + React + hand-written SVG. No charting library. Must build to a static site (`vite build`) with no server.
- **Exorcist:** a Kiro Crew app (`app.json`, `agents/`, `skills/`) and a standalone CLI entry point. The CLI must work without Crew installed.
- **Git access:** shell out to the `git` binary with `child_process`. Do not add a git library.

## Rules

1. **Few dependencies.** Before adding a package, say why Node's standard library is not enough. Prefer `node:fs`, `node:path`, `node:child_process`, `node:crypto`.
2. **Offline.** Analyzers make no network calls. Tests make no network calls.
3. **Deterministic.** Same input repo, same output. Sort results; never depend on object key order or wall-clock time except where the input explicitly carries dates.
4. **Core is app-agnostic.** `core/` must not import from `apps/` or `mcp/`, and must not import React, Vite, or anything Crew-specific.
5. **Verify Kiro facts; never guess them.** Exorcist's rules encode what a valid `.kiro/` looks like. Every rule must cite the doc URL it came from (see `docs/kiro-verification.md`). If a fact cannot be verified against https://kiro.dev/docs, mark it `TODO(verify)` and do not ship the rule as a hard error.
6. **Tests before done.** A task is finished when its tests pass under `npm test`. Property tests must cover the two invariants in the core spec (score monotonicity and spec-writer subject round-trip).
7. **No secrets anywhere.** Steering, hooks, and agents are committed. Nothing in `.kiro/` may contain a token or key.

## Commands

```bash
npm install            # once
npm test               # all tests
npm run typecheck      # tsc on core
npm run sample-repo    # regenerate examples/sample-repo/out (a git repo with seeded history)
```

## Verified Kiro facts used by this project

Kept in `docs/kiro-verification.md` with URLs and the date checked. Read it before writing any file under `.kiro/`.
