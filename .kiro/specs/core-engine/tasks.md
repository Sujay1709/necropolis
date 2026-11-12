# Tasks — Core Engine

Each task is small, independently testable, and ordered so earlier tasks unblock
later ones. Check off a task only when its tests pass offline.

- [x] 1. Scaffold pnpm workspace + `core` package
  - Root `package.json` with pnpm workspaces; `pnpm-workspace.yaml` listing
    `core`, `apps/*`, `examples/*`.
  - `core/package.json` (ESM, type: module), strict `tsconfig.json`, Vitest
    config. Node 22 engines field.
  - Verify: `pnpm install` succeeds; `pnpm -C core test` runs (0 tests OK).
  - _Requirements: tech stack; 6.4_

- [x] 2. Haunting schema + validation (`core/src/haunting.ts`)
  - Define `HauntingKind`, `Haunting`, `validateHaunting`, `isHaunting`.
  - Verify (unit): accepts a valid haunting; rejects bad `kind`, `severity`
    out of `[0,1]`, missing fields — error names the offending field.
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 3. Stable id/slug helpers (`core/src/slug.ts`)
  - `shortHash(s)`, `hauntingId({analyzer,kind,subject})`, `slugFor(input)`.
  - Verify (unit): same input → same id/slug; slugs are kebab-case and
    filesystem-safe; different subjects → different ids.
  - _Requirements: 1.4, 5.2_

- [x] 4. Analyzer contract (`core/src/analyzer.ts`)
  - Define `AnalyzerContext` and `Analyzer` interfaces; no implementation.
  - Verify (type-level): a sample in-memory analyzer satisfies the interface
    and compiles under strict mode.
  - _Requirements: 2.1, 2.2_

- [x] 5. Registry with isolation + ordering (`core/src/registry.ts`)
  - `register` (dup-name guard), `run` returning `{ hauntings, errors }`,
    deterministic sort (`kind`→`subject`→`id`), per-haunting `validateHaunting`.
  - Verify (unit): merges multiple analyzers; one throwing analyzer is captured
    in `errors` while others still return (3.3); duplicate name rejected (3.4);
    output order stable regardless of registration order (3.2).
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 6. Scoring (`core/src/score.ts`)
  - Implement documented formula with named `W` (per-kind weights) and `K`.
  - Verify (unit): `score([])===0`; integer in `[0,100]`; order-independent on
    a fixed vector.
  - _Requirements: 4.1, 4.2, 4.4_

- [ ] 7. Property test: score monotonicity (`core/src/score.prop.test.ts`)
  - fast-check: for arbitrary `Haunting[]`, adding a haunting ⇒ `score' >=
    score`; raising any `severity` ⇒ `score' >= score`.
  - _Requirements: 4.3, 6.2_

- [ ] 8. Spec writer (`core/src/spec-writer.ts`)
  - `writeSpec(input, targetRoot)`; deterministic slug; writes
    `requirements.md` (EARS; bugfix framing for `cursed-file`), `design.md`,
    `tasks.md`; emits every `subject` verbatim; containment check refuses writes
    outside `<targetRoot>/.kiro/specs/`.
  - Verify (unit, temp dir): creates the three files; idempotent slug; refuses a
    crafted traversal input; files contain each subject.
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 9. Property test: subject round-trip (`core/src/spec-writer.prop.test.ts`)
  - fast-check: for an arbitrary `Haunting`, `writeSpec` output text contains
    `subject` verbatim. Temp dir per run; cleaned up.
  - _Requirements: 5.4, 6.3_

- [ ] 10. Public barrel + core README (`core/src/index.ts`, `core/README.md`)
  - Export the public surface; short README documenting the pipeline, schema,
    scoring formula/weights, and the app-agnostic rule.
  - Verify: importing from the package root exposes schema, registry, score,
    writer; `pnpm -C core test` all green.
  - _Requirements: 4.4; structure "core stays app-agnostic"_

- [ ] 11. Sample-repo generator (`examples/sample-repo/generate.ts`)
  - Build a repo with seeded, deterministic git history (pinned dates/author/
    messages): one "cursed" file (high churn + "fix"/"bug" messages), one calm
    file, a placeholder coverage artifact. Offline only.
  - Verify: run twice into clean temp dirs ⇒ equivalent commit history; a churn
    probe finds more recent commits on the cursed file than the calm file.
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ] 12. Wire CI-style check script (offline)
  - Root script `pnpm test` runs the full core suite (unit + property) with no
    network. Document the command in `core/README.md`.
  - Verify: fresh checkout → `pnpm install && pnpm test` passes offline.
  - _Requirements: 6.1, 6.4_
