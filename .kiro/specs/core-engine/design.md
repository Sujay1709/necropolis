# Design Document: core-engine

## Overview

`@necropolis/core` is a small TypeScript library with no runtime dependencies. It exposes four things: the `Haunting` schema with a validating constructor, an `Analyzer` registry, a `score` function with an explainable breakdown, and a spec writer that renders Kiro bugfix and feature specs. Two reference analyzers (`git-churn`, `coverage`) prove the contract end to end and are what Graveyard uses. Exorcist's analyzers live in `apps/exorcist` but implement the same contract.

Design goals, in priority order: **deterministic**, **app-agnostic**, **small**, **explainable**.

## Architecture

```
            +-------------------+        +------------------+
 rootDir -->|  Analyzer (n)     |--+     |  score()         |--> 0..100
            |  analyze(ctx)     |  |     |  scoreBreakdown()|--> per kind
            +-------------------+  v     +------------------+
                             Haunting[] ---+
                                           |   +------------------+
                                           +-->|  specWriter      |--> .kiro/specs/<slug>/
                                           |   |  render* / write*|
                                           |   +------------------+
                                           +--> apps (Graveyard map, Exorcist CLI/Crew)
```

Data flows one way. Nothing in core imports from `apps/` or `mcp/`.

## Components and Interfaces

### `core/src/haunting.ts`

```ts
export const HAUNTING_KINDS = ["cursed-file","steering-conflict","dead-hook","over-budget","spec-drift","legacy-config"] as const;
export type HauntingKind = typeof HAUNTING_KINDS[number];
export interface Haunting { id; kind; severity; subject; evidence; suggestedFix; analyzer } // see steering/haunting-schema.md
export type HauntingInput = Omit<Haunting, "id" | "evidence"> & { evidence?: string[] };
export function createHaunting(input: HauntingInput): Haunting;
export function isHaunting(v: unknown): v is Haunting;
export function hauntingId(kind: HauntingKind, subject: string): string; // sha1(`${kind}\0${subject}`).slice(0,12)
export function compareHauntings(a: Haunting, b: Haunting): number; // severity desc, subject asc
export class HauntingValidationError extends Error { field: string }
```

`id` is a prefix of a SHA-1 over kind and subject. Node's `node:crypto` is enough; no package.

### `core/src/analyzer.ts`

```ts
export interface AnalyzeContext { rootDir: string; now?: Date }
export interface Analyzer { name: string; kinds: HauntingKind[]; analyze(ctx: AnalyzeContext): Promise<Haunting[]> }
export interface Registry {
  register(a: Analyzer): Registry;
  get(name: string): Analyzer | undefined;
  list(): string[];
  run(ctx: AnalyzeContext, names?: string[]): Promise<Haunting[]>;
}
export function createRegistry(): Registry;
export class DuplicateAnalyzerError extends Error {}
export class UnknownAnalyzerError extends Error {}
export class AnalyzerContractError extends Error {}
```

`run` resolves `now` once (`ctx.now ?? new Date()`), runs analyzers with `Promise.all` (any rejection rejects the whole run), validates each result against the analyzer's declared `kinds`, then sorts with `compareHauntings`.

### `core/src/score.ts`

Score is a saturating sum so that it is monotonic and bounded.

```
weight(kind): cursed-file 1.0, dead-hook 0.9, over-budget 0.8, steering-conflict 0.8, spec-drift 0.6, legacy-config 0.4
raw        = sum over hauntings of weight(kind) * severity
score      = round(100 * (1 - exp(-raw / K)))      with K = 1.6
```

Why this shape: adding a term never lowers `raw`, `exp` is monotonic, and the result is bounded in [0, 100). One haunting at severity 1 with weight 1 gives `100 * (1 - e^(-1/1.6)) = 46`, which satisfies Requirement 3.6. `scoreBreakdown` returns `{ kind, raw, share }` per kind, where `share = round(score * raw_kind / raw)` with largest-remainder rounding so shares sum exactly to `score`. Rounding uses `Math.round` on a value that is first fixed to 6 decimals, to avoid platform float noise.

### `core/src/spec-writer.ts`

```ts
export interface WriteOptions { rootDir: string; overwrite?: boolean }
export interface WriteResult { written: boolean; path: string; files: string[] }
export function renderBugfixSpec(h: Haunting): { "bugfix.md": string; "design.md": string; "tasks.md": string };
export function renderFeatureSpec(hs: Haunting[], name: string): { "requirements.md": string; "design.md": string; "tasks.md": string };
export function writeBugfixSpec(h: Haunting, o: WriteOptions): Promise<WriteResult>;
export function writeFeatureSpec(hs: Haunting[], o: WriteOptions & { name: string }): Promise<WriteResult>;
export function parseSpecSubjects(markdown: string): string[];
export function specSlug(h: Haunting): string; // `fix-` + subject basename kebab + `-` + id.slice(0,6)
```

Subjects are rendered inside backticks on a line of their own, `Subject: \`src/checkout/cart.ts\``, which is what `parseSpecSubjects` scans for. That line format is the round-trip contract and is tested with a property test over arbitrary POSIX relative paths.

Templates live as template-literal functions in `core/src/templates/bugfix.ts` and `core/src/templates/feature.ts`. No template engine.

### `core/src/analyzers/git-churn.ts`

One call: `git log --since=<now-90d ISO> --name-only --format='%H%x1f%an%x1f%s' -- .` run with `cwd: rootDir`. Parse into `{ hash, author, subject, files[] }` records. Aggregate per file: `commits`, `fixes`, `authors: Set`.

```
churnNorm = min(1, commits / 40)
fixShare  = fixes / commits
authorsN  = min(1, (authors - 1) / 5)
severity  = clamp01(0.5 * churnNorm + 0.35 * fixShare + 0.15 * authorsN)
```

Emit only when `commits >= minCommits` (default 8). `suggestedFix` is one sentence: "Add a regression test for the recurring failures in <subject> and split it if it has more than one responsibility." Options `{ minCommits?, windowDays? }` are accepted by a factory `createGitChurnAnalyzer(opts)`; the default export `gitChurnAnalyzer` uses defaults.

### `core/src/analyzers/coverage.ts`

Reads `coverage/coverage-summary.json`. Istanbul's summary is `{ total: {...}, "<path>": { lines: { total, covered, skipped, pct }, ... } }`. Keys may be absolute; normalize with `path.relative(rootDir, key)` and `split(sep).join("/")`. Emits `cursed-file` with `severity = clamp01((threshold - pct) / threshold)`.

`mergeCursedFiles` lives in `core/src/merge.ts` and combines same-subject hauntings with the noisy-or rule `1 - prod(1 - s_i)` so that two independent weak signals compound without exceeding 1.

### `examples/sample-repo/generate.mjs`

Plain Node ESM script, no dependencies. Uses a seeded PRNG (mulberry32) so file and message choices are reproducible. Creates commits by writing files and running `git commit` with `GIT_AUTHOR_DATE`/`GIT_COMMITTER_DATE` spread evenly across the window. Also writes the haunted `.kiro/` folder described in Requirement 7.4 and the coverage summary. It is the fixture for Graveyard, Exorcist, and the `git-churn` tests.

## Data Models

See `.kiro/steering/haunting-schema.md`. The only persisted artifacts are the spec Markdown files; there is no database and no cache.

## Error Handling

- Validation errors are thrown synchronously from `createHaunting` with a `field` property.
- Registry errors (`Duplicate`, `Unknown`, `Contract`) are thrown before or during `run`; a run never returns partial results.
- `git-churn` wraps `git` failures: exit code 128 with "not a git repository" becomes `NotAGitRepositoryError`; anything else is rethrown with the stderr attached.
- `coverage` treats a missing summary as "no information" (empty array) and a malformed one as an error, because silence on malformed input would hide a broken toolchain.
- The spec writer never overwrites without `overwrite: true`.

## Testing Strategy

- **Unit tests** per module in `core/test/*.test.ts`, run with Vitest.
- **Fixtures**: `core/test/fixtures/<analyzer>/` for coverage; `git-churn` tests generate a tiny repo in a temp directory with `examples/sample-repo/generate.mjs --small` (about 30 commits) so they run in under 2 seconds.
- **Property tests** in `core/test/properties.test.ts` with `fast-check`:
  1. *Score monotonicity.* For arbitrary `Haunting[]` and an arbitrary extra haunting, `score(hs.concat(h)) >= score(hs)`; and for an arbitrary index and a severity increase, the score does not decrease. Also order independence under shuffling.
  2. *Spec-writer round trip.* For arbitrary POSIX relative paths (including spaces, dots, unicode letters, and `#`), rendering a bugfix spec and calling `parseSpecSubjects` returns the subject exactly once.
- **Repo-level checks** in `tests/` (already present) keep `.kiro/` valid and specs well-formed. They run in the same `npm test`.
- Coverage target for core: 90% lines, enforced in Phase 5 if time allows, not before.
