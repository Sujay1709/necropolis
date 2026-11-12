---
inclusion: always
---

# Necropolis: structure

```
.kiro/
  steering/          product.md, tech.md, structure.md (always), haunting-schema.md (fileMatch core/**)
  specs/             one folder per subsystem: core-engine, graveyard, exorcist, ...
  hooks/             on-analyzer-save.json, on-stop-tests.json
  agents/            spec-writer.json, reviewer.json (+ prompts/)
core/                the skeleton. Published as @necropolis/core (workspace only)
  src/
    index.ts         public API re-exports
    haunting.ts      Haunting type, kinds, validation
    analyzer.ts      Analyzer contract + registry
    score.ts         haunting score
    spec-writer.ts   Haunting[] -> .kiro/specs/<slug>/ files
    analyzers/       one file per analyzer, exported from analyzers/index.ts
  test/              mirrors src/, plus properties.test.ts
apps/
  graveyard/         Vite + React static site (Phase 3)
  exorcist/          Crew app + CLI (Phase 4)
mcp/                 optional MCP server exposing core (Phase 5, only if time remains)
examples/sample-repo/
  generate.mjs       builds a demo git repo with seeded history and a haunted .kiro/
  out/               generated, gitignored
scripts/hooks/       commands run by .kiro/hooks
tests/               repo-level checks (Kiro config validity, spec structure, sample repo)
docs/                kiro-verification.md, decisions
```

## Conventions

- **Files:** kebab-case (`spec-writer.ts`). **Types:** PascalCase. **Functions and variables:** camelCase. **Haunting kinds:** kebab-case string literals.
- **One analyzer per file.** Each analyzer exports a single `Analyzer` object named `<name>Analyzer` and is listed in `core/src/analyzers/index.ts`. The `on-analyzer-save` hook checks this.
- **Each analyzer has a test file** at `core/test/analyzers/<name>.test.ts` that runs it against a fixture directory under `core/test/fixtures/`.
- **Imports:** relative within a package; `@necropolis/core` from apps and mcp. Core imports nothing from apps or mcp.
- **Specs name the code they produce.** Every task in `tasks.md` names the files it creates or changes, so spec drift can be detected mechanically.
- **Generated things are gitignored** (`dist/`, `coverage/`, `examples/sample-repo/out/`). `.kiro/` is never gitignored.
