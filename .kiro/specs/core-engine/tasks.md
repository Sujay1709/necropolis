# Implementation Plan: core-engine

Tasks are ordered by dependency. Tasks marked `[parallel]` in a group can run concurrently once their dependencies are done. Every task names the files it creates or changes and ends with the requirements it satisfies.

- [ ] 1. Haunting schema and validation
  - Create `core/src/haunting.ts` with `HAUNTING_KINDS`, `Haunting`, `HauntingInput`, `createHaunting`, `isHaunting`, `hauntingId`, `compareHauntings`, `HauntingValidationError`.
  - `hauntingId` uses `node:crypto` SHA-1 over `${kind}\0${subject}`, first 12 hex chars.
  - Create `core/test/haunting.test.ts` covering each validation rule, id stability, evidence sort/dedupe, and `isHaunting` never throwing.
  - Re-export everything from `core/src/index.ts`.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

- [ ] 2. Analyzer contract and registry
  - Create `core/src/analyzer.ts` with `AnalyzeContext`, `Analyzer`, `Registry`, `createRegistry`, and the three error classes.
  - `run` resolves `now` once, runs with `Promise.all`, validates kinds against `analyzer.kinds`, sorts with `compareHauntings`.
  - Create `core/test/analyzer.test.ts` using two fake analyzers: duplicate registration, unknown name, contract violation, rejection propagation with no partial results, shared `now`.
  - Create `core/src/analyzers/index.ts` (empty export list for now; tasks 6 and 7 add to it).
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

- [ ] 3. Score and breakdown
  - Create `core/src/score.ts` with `KIND_WEIGHTS`, `K = 1.6`, `score`, `scoreBreakdown` (largest-remainder rounding so shares sum to the score).
  - Create `core/test/score.test.ts`: empty is 0, single severity-1 cursed-file is >= 40, integer bounds, breakdown sums to score for a hand-built set.
  - _Requirements: 3.1, 3.2, 3.3, 3.6, 3.8_

- [ ] 4. Property tests for score [parallel with 5]
  - Create `core/test/properties.test.ts` (score section) with `fast-check` arbitraries for `Haunting` (valid kinds, severity in [0,1], short POSIX subjects).
  - Properties: append never lowers score; raising one severity never lowers score; shuffling does not change score; determinism across two calls.
  - _Requirements: 3.3, 3.4, 3.5, 3.7_

- [ ] 5. Spec writer: templates and rendering [parallel with 4]
  - Create `core/src/templates/bugfix.ts` and `core/src/templates/feature.ts` as template functions returning the three file bodies. Subject appears on its own line as `Subject: \`<subject>\``.
  - Create `core/src/spec-writer.ts` with `specSlug`, `renderBugfixSpec`, `renderFeatureSpec`, `parseSpecSubjects`.
  - Bugfix task 1 is a regression test naming `core/test/regressions/<slug>.test.ts` style path under the *target* repo; when evidence mentions rounding/ordering/boundary the task text asks for `fast-check`.
  - Create `core/test/spec-writer.test.ts`: EARS regex on every criterion line, task line format, `_Requirements:_` trailer on every task, regression-test-first rule, property-test wording trigger.
  - _Requirements: 4.3, 4.4, 4.5, 4.6, 4.8, 4.9_

- [ ] 6. Spec writer: filesystem write and property round trip
  - Extend `core/src/spec-writer.ts` with `writeBugfixSpec` and `writeFeatureSpec` (create dirs with `fs/promises`, refuse to overwrite without `overwrite: true`, return `WriteResult`).
  - Extend `core/test/spec-writer.test.ts` with temp-dir write tests (fresh write, refuse overwrite, overwrite flag, feature spec with three hauntings yields three requirements).
  - Extend `core/test/properties.test.ts` (spec-writer section): for arbitrary POSIX relative paths, `parseSpecSubjects(renderBugfixSpec(h)["bugfix.md"])` equals `[h.subject]`.
  - _Requirements: 4.1, 4.2, 4.7, 4.9_

- [ ] 7. Sample repository generator [parallel with 5, 6]
  - Create `examples/sample-repo/generate.mjs` (already scaffolded in Phase 1; complete any `TODO` and keep the CLI `node generate.mjs <outDir> [--force] [--small] [--seed N]`).
  - Verify against `tests/sample-repo.test.ts` (already present): commit counts, bug-fix counts, authors, coverage summary, haunted `.kiro/` contents, refuse-without-force.
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [ ] 8. Git churn analyzer
  - Create `core/src/analyzers/git-churn.ts` with `createGitChurnAnalyzer(opts)` and `gitChurnAnalyzer`; single `git log` invocation; `NotAGitRepositoryError` in `core/src/errors.ts`.
  - Export from `core/src/analyzers/index.ts` and `core/src/index.ts`.
  - Create `core/test/analyzers/git-churn.test.ts` using the generator with `--small` in a temp dir: `src/checkout/cart.ts` is emitted, quiet files are not, evidence strings present, severity in range, non-repo rejects, `now` injected (no `Date.now` by stubbing `Date.now` to throw).
  - Create `core/test/fixtures/git-churn/README.md` explaining that the fixture is generated at test time.
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

- [ ] 9. Coverage analyzer and merge
  - Create `core/src/analyzers/coverage.ts` with `createCoverageAnalyzer({ threshold })` and `coverageAnalyzer`; create `core/src/merge.ts` with `mergeCursedFiles`.
  - Export both from `core/src/analyzers/index.ts` / `core/src/index.ts`.
  - Create `core/test/fixtures/coverage/coverage/coverage-summary.json` with absolute and relative keys, and `core/test/analyzers/coverage.test.ts`: below-threshold emits with correct severity, missing file yields `[]`, malformed file throws, absolute keys normalized, merge noisy-or and evidence concat.
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 10. End-to-end on the sample repo
  - Create `core/test/e2e.test.ts`: generate the sample repo, run a registry with `git-churn` + `coverage`, merge, assert `src/checkout/cart.ts` is the top haunting, `score` is between 40 and 100, write a bugfix spec into the temp repo and read it back with `parseSpecSubjects`.
  - Update `README.md` status table: core = working, with the command to reproduce.
  - _Requirements: 2.4, 3.6, 4.1, 5.2, 6.5, 7.1_
