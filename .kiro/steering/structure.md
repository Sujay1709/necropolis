# Structure — NECROPOLIS

## Repository layout
```
.kiro/
  steering/      product.md, tech.md, structure.md   (this folder)
  specs/         one folder per spec (requirements.md, design.md, tasks.md)
  hooks/         standalone *.json hooks
  agents/        custom agent definitions
core/            analyzer contract, Haunting schema, scoring, spec writer
apps/
  graveyard/     web app (Vite + React + SVG). Static deploy.
  exorcist/      Crew app (app.json, agents, skills) + CLI entry
mcp/             OPTIONAL, LAST: MCP server exposing core to Kiro
examples/
  sample-repo/   script that generates a small repo with seeded git history
LICENSE
README.md        starts with a 60-second "judge path"
```

## The one rule that matters: the core stays app-agnostic
`core/` must not import from `apps/graveyard/` or `apps/exorcist/`, and must
not know either app exists. Dependencies point **inward only**:

```
apps/graveyard  ─┐
                 ├─>  core   (never the reverse)
apps/exorcist   ─┘
mcp             ─┘
```

Concretely:
- `core/` owns the shared contract: the **Haunting** schema, the **Analyzer**
  interface, the analyzer **registry**, **scoring**, and the **spec writer**.
- `core/` has **no** DOM, React, CLI-arg parsing, or Crew-specific code.
- An app contributes value only by (a) choosing which analyzers to register and
  (b) presenting the resulting `Haunting[]`. Graveyard draws them; Exorcist
  scores and reports them. Neither forks the pipeline.
- Analyzers depend only on `{ rootDir }` and the filesystem/git — never on an
  app. This is what makes the same analyzer usable from either app.

If a change requires `core/` to import an app, the design is wrong — push the
shared piece down into `core/` instead.

## Naming & conventions
- TypeScript strict everywhere. Node 22, ESM modules.
- One analyzer per file under the owning app, each exporting an
  `Analyzer`-shaped object; registration is explicit in the app entry point.
- Spec folder slugs are kebab-case and derived deterministically from a
  haunting (so re-running is idempotent).
- Tests live next to the code (`*.test.ts`); property-based tests use
  fast-check and are named `*.prop.test.ts`.
