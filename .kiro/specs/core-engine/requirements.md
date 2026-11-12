# Requirements Document

## Introduction

`@necropolis/core` is the skeleton shared by Graveyard and Exorcist. It defines the `Haunting` schema, the `Analyzer` contract and registry, a deterministic `score`, and a `specWriter` that turns hauntings into Kiro specs. It has no UI, no network access, and no knowledge of Kiro Crew. Everything in this document is testable with Vitest and, where an invariant is stated, with `fast-check`.

Scope note: this spec covers the engine and the two analyzers needed to prove it end to end (`git-churn` and `coverage`). The `.kiro/`-auditing analyzers belong to the `exorcist` spec and only have to *fit* the contract defined here.

## Requirements

### Requirement 1: Haunting schema

**User Story:** As an app developer, I want every analyzer to emit the same `Haunting` shape, so that Graveyard and Exorcist can share scoring, sorting, and spec writing without adapters.

#### Acceptance Criteria

1. WHEN a `Haunting` is constructed through `createHaunting(input)` THEN the system SHALL return an object with exactly the fields `id`, `kind`, `severity`, `subject`, `evidence`, `suggestedFix`, `analyzer` as defined in `.kiro/steering/haunting-schema.md`.
2. WHEN `severity` is not a finite number in the closed range [0, 1] THEN `createHaunting` SHALL throw a `HauntingValidationError` naming the field.
3. WHEN `kind` is not one of the six `HauntingKind` literals THEN `createHaunting` SHALL throw a `HauntingValidationError` naming the field.
4. WHEN `subject` contains a backslash or is absolute THEN `createHaunting` SHALL throw a `HauntingValidationError` (subjects are POSIX paths relative to `rootDir`).
5. WHEN `evidence` is provided THEN the system SHALL store it sorted ascending by string comparison, with duplicates removed.
6. WHEN two hauntings have the same `kind` and `subject` THEN the system SHALL assign them the same `id`, and WHEN either differs THEN the ids SHALL differ.
7. WHEN `isHaunting(value)` is called with any value THEN the system SHALL return `true` only for values that would pass `createHaunting` validation, without throwing.

### Requirement 2: Analyzer contract and registry

**User Story:** As a contributor, I want to add an analyzer by writing one file, so that each app can compose the analyzers it needs without touching the engine.

#### Acceptance Criteria

1. WHEN an object has `name` (kebab-case, non-empty), `kinds` (non-empty array of `HauntingKind`), and `analyze(ctx)` returning `Promise<Haunting[]>` THEN the system SHALL accept it as an `Analyzer`.
2. WHEN `createRegistry()` is called THEN the system SHALL return a registry with `register(analyzer)`, `get(name)`, `list()`, and `run(ctx, names?)`.
3. WHEN `register` is called twice with the same `name` THEN the system SHALL throw a `DuplicateAnalyzerError`.
4. WHEN `run(ctx)` is called THEN the system SHALL run every registered analyzer, concatenate results, and return them sorted by `severity` descending then `subject` ascending.
5. WHEN `run(ctx, names)` is called with a subset THEN the system SHALL run only those analyzers, and WHEN a name is unknown THEN it SHALL throw an `UnknownAnalyzerError` before running anything.
6. WHEN an analyzer emits a `Haunting` whose `kind` is not in that analyzer's declared `kinds` THEN `run` SHALL throw an `AnalyzerContractError` identifying the analyzer and the kind.
7. WHEN an analyzer rejects THEN `run` SHALL reject with an error that includes the analyzer name, and results from other analyzers SHALL NOT be returned partially.
8. WHEN `ctx.now` is omitted THEN the registry SHALL set it to the current time once and pass the same `Date` to every analyzer in that run.

### Requirement 3: Haunting score

**User Story:** As a user, I want one number that summarizes how haunted a project is, so that I can track it over time and compare branches.

#### Acceptance Criteria

1. WHEN `score(hauntings)` is called THEN the system SHALL return an integer in [0, 100].
2. WHEN `hauntings` is empty THEN `score` SHALL return 0.
3. WHEN the same array is scored twice THEN the results SHALL be identical (no time or randomness).
4. WHEN a haunting is appended to the array THEN the score SHALL be greater than or equal to the score without it (monotonic in count).
5. WHEN any single haunting's `severity` is increased and nothing else changes THEN the score SHALL be greater than or equal to the previous score (monotonic in severity).
6. WHEN the array contains one haunting with severity 1 THEN `score` SHALL return at least 40, so that a single critical finding is visible.
7. WHEN `score` is called with an array in a different order THEN the result SHALL be identical (order-independent).
8. WHEN `scoreBreakdown(hauntings)` is called THEN the system SHALL return the per-kind contributions that sum, after rounding, to `score(hauntings)`, so that the UI can explain the number.

### Requirement 4: Spec writer

**User Story:** As a developer, I want a haunting turned into a Kiro spec I can review, so that fixing it is a normal Kiro task rather than a note in a dashboard.

#### Acceptance Criteria

1. WHEN `writeBugfixSpec(haunting, { rootDir })` is called with a `cursed-file` haunting THEN the system SHALL create `.kiro/specs/<slug>/bugfix.md`, `design.md`, and `tasks.md` under `rootDir`, where `<slug>` is derived from `subject` and is unique per `id`.
2. WHEN `writeFeatureSpec(hauntings, { rootDir, name })` is called with one or more non-`cursed-file` hauntings THEN the system SHALL create `.kiro/specs/<name>/requirements.md`, `design.md`, and `tasks.md`, with one requirement per haunting.
3. WHEN any spec is written THEN `subject` SHALL appear verbatim in `bugfix.md`/`requirements.md` and in at least one task line of `tasks.md`.
4. WHEN any spec is written THEN every acceptance criterion line SHALL match the EARS pattern `^\d+\. (WHEN|IF|WHILE) .+ (THEN|the system) .*SHALL .+$`.
5. WHEN any spec is written THEN `tasks.md` SHALL contain at least one task line matching `^- \[ \] \d+\. ` and every task SHALL end with a `_Requirements: ..._` line.
6. WHEN a `cursed-file` bugfix spec is written THEN the first task SHALL be a regression test that names a test file path, and WHEN `evidence` mentions "rounding", "ordering", or "boundary" THEN that task SHALL ask for a property-based test with `fast-check`.
7. WHEN the target spec directory already exists THEN the system SHALL NOT overwrite it unless `overwrite: true` is passed, and SHALL return `{ written: false, path }`.
8. WHEN `renderBugfixSpec(haunting)` or `renderFeatureSpec(hauntings, name)` is called THEN the system SHALL return the file contents as strings without touching the filesystem, so that apps can preview before writing.
9. WHEN `parseSpecSubjects(markdown)` is called on a rendered `bugfix.md` or `requirements.md` THEN the system SHALL return every `subject` that was rendered into it (round trip).

### Requirement 5: Git churn analyzer

**User Story:** As a Graveyard user, I want files ranked by how often they change and how often those changes are bug fixes, so that the map shows real pain, not file size.

#### Acceptance Criteria

1. WHEN `gitChurnAnalyzer.analyze({ rootDir, now })` runs on a git repository THEN the system SHALL count, per tracked file, commits in the 90 days before `now` and the subset whose first line matches `/^(fix|bugfix|hotfix)(\(|:|!|\s)/i` or contains `#\d+` together with "fix".
2. WHEN a file has at least `minCommits` (default 8) commits in the window THEN the system SHALL emit a `cursed-file` haunting for it, and WHEN it has fewer THEN it SHALL NOT.
3. WHEN a haunting is emitted THEN `severity` SHALL be computed as documented in `design.md` from churn, bug-fix share, and author count, and SHALL be in [0, 1].
4. WHEN a haunting is emitted THEN `evidence` SHALL include the commit count, the bug-fix commit count, and the distinct author count as separate strings.
5. WHEN `rootDir` is not a git repository THEN `analyze` SHALL reject with `NotAGitRepositoryError`.
6. WHEN the analyzer runs THEN it SHALL make exactly one `git log` invocation (no per-file calls), so that a 10,000-commit repo finishes in under 5 seconds on the sample hardware.
7. WHEN the analyzer runs THEN it SHALL NOT read `Date.now()`; all time comes from `ctx.now`.

### Requirement 6: Coverage analyzer

**User Story:** As a Graveyard user, I want low test coverage to darken a tombstone, so that cursed files without a safety net stand out.

#### Acceptance Criteria

1. WHEN `coverage/coverage-summary.json` (Istanbul JSON summary format) exists under `rootDir` THEN the system SHALL read per-file `lines.pct` from it.
2. WHEN a file's `lines.pct` is below `threshold` (default 50) THEN the system SHALL emit a `cursed-file` haunting with severity `(threshold - pct) / threshold` clamped to [0, 1] and evidence naming the percentage.
3. WHEN no coverage summary exists THEN `analyze` SHALL resolve to an empty array and SHALL NOT throw.
4. WHEN the summary contains absolute paths THEN the system SHALL convert them to paths relative to `rootDir` with POSIX separators before using them as `subject`.
5. WHEN `mergeCursedFiles(hauntings)` is called with hauntings from several analyzers that share a `subject` THEN the system SHALL return one haunting per subject with `severity = 1 - prod(1 - s_i)`, concatenated sorted evidence, and `analyzer` set to the comma-joined analyzer names.

### Requirement 7: Sample repository generator

**User Story:** As a judge or teammate, I want a reproducible demo repo, so that both apps can be shown in under a minute without cloning anything external.

#### Acceptance Criteria

1. WHEN `node examples/sample-repo/generate.mjs <outDir>` runs THEN the system SHALL create a git repository at `<outDir>` with at least 120 commits spread over the 90 days before the run, authored by at least 5 distinct names.
2. WHEN the generator runs THEN `src/checkout/cart.ts` SHALL have at least 40 commits of which at least 15 are bug fixes, and at least 10 other files SHALL have 3 or fewer commits each.
3. WHEN the generator runs THEN the system SHALL write `coverage/coverage-summary.json` with `src/checkout/cart.ts` below 30% line coverage and at least 5 files above 80%.
4. WHEN the generator runs THEN the system SHALL write a `.kiro/` folder containing, at minimum: two steering files that contradict each other, one hook using the CLI 2.x trigger name `agentSpawn`, one hook whose command script does not exist, one agent with more than 32 `file://` resources and a legacy `allowedTools` field, and one spec task marked `[x]` that names a file which does not exist.
5. WHEN the generator runs twice with the same seed THEN the resulting commit messages, file set, and coverage numbers SHALL be identical (commit hashes may differ because of timestamps).
6. WHEN `<outDir>` already exists THEN the generator SHALL refuse unless `--force` is passed.
