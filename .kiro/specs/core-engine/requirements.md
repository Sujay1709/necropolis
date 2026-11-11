# Requirements — Core Engine

## Introduction
The core engine is the shared "skeleton" of NECROPOLIS. It defines the one
`Haunting` schema, the `Analyzer` contract, an analyzer registry, a
deterministic scoring function, and a spec writer that turns hauntings into
Kiro specs. Both Graveyard and Exorcist depend on this engine and differ only
in which analyzers they register and how they present results. The core must be
app-agnostic (no DOM, React, CLI, or Crew code) and fully offline.

Requirements use EARS notation ("WHEN ... THEN the system SHALL ...",
"WHILE ...", "IF ... THEN ...", "The system SHALL ...").

## Glossary
- **Haunting** — one detected problem, in the shared schema below.
- **Analyzer** — a named unit that inspects a root directory and returns
  `Haunting[]`.
- **Registry** — a collection of analyzers run together over one root.
- **Score** — a 0–100 number summarizing a set of hauntings; lower is better.

---

## Requirement 1 — Haunting schema
**User story:** As an app author, I want every analyzer to emit the same
`Haunting` shape, so that scoring, presentation, and spec writing work
identically regardless of which analyzer produced the finding.

### Acceptance criteria
1. The system SHALL define a `Haunting` with fields: `id` (string),
   `kind` (one of `"cursed-file" | "steering-conflict" | "dead-hook" |
   "over-budget" | "spec-drift" | "legacy-config"`), `severity`
   (number in `[0,1]`), `subject` (string path), `evidence` (`string[]`),
   `suggestedFix` (string), and `analyzer` (string).
2. WHEN a value is validated against the `Haunting` schema THEN the system SHALL
   accept it only if `severity` is a finite number in the inclusive range
   `[0,1]` and `kind` is one of the allowed literals.
3. IF a candidate object is missing a required field or has `severity` outside
   `[0,1]` THEN the system SHALL reject it with a descriptive error naming the
   offending field.
4. The system SHALL treat `id` as stable for the same underlying finding, so
   that re-running an analyzer on unchanged input yields the same `id`.

## Requirement 2 — Analyzer contract
**User story:** As an analyzer author, I want a minimal, uniform interface, so
that my analyzer can run from any app without knowing which app called it.

### Acceptance criteria
1. The system SHALL define an `Analyzer` as `{ name: string;
   analyze(ctx: { rootDir: string }): Promise<Haunting[]> }`.
2. WHEN an analyzer's `analyze` is called with a valid `rootDir` THEN the
   system SHALL resolve to an array of schema-valid `Haunting` objects (possibly
   empty).
3. The system SHALL NOT require network access from any analyzer; analyzers
   SHALL operate only on the filesystem and local git state under `rootDir`.
4. IF `rootDir` does not exist or is not readable THEN the analyzer SHALL reject
   with a descriptive error rather than returning partial/garbage results.

## Requirement 3 — Analyzer registry
**User story:** As an app author, I want to register a chosen set of analyzers
and run them over one root, so that each app controls its own analyzer mix
without reimplementing orchestration.

### Acceptance criteria
1. The system SHALL provide a registry that accepts a list of `Analyzer`s and
   runs them over a single `{ rootDir }`.
2. WHEN the registry runs THEN the system SHALL aggregate all returned
   hauntings into one `Haunting[]` with deterministic ordering (sorted by
   a documented key, e.g. `kind` then `subject` then `id`).
3. IF one analyzer throws THEN the system SHALL isolate the failure, record it,
   and still return the hauntings produced by the other analyzers.
4. The system SHALL reject registering two analyzers with the same `name`.

## Requirement 4 — Scoring
**User story:** As a user, I want a single 0–100 haunting score, so that I can
tell at a glance how cursed a project is and watch it improve.

### Acceptance criteria
1. The system SHALL compute `score(hauntings): number` returning an integer in
   `[0,100]`, where **lower is better** and `score([]) === 0`.
2. The scoring function SHALL be **deterministic**: the same input multiset
   always yields the same score, independent of input ordering.
3. The scoring function SHALL be **monotonic**: WHEN a haunting is added to the
   set, OR WHEN any existing haunting's `severity` is increased, THEN the new
   score SHALL be greater than or equal to the previous score.
4. The system SHALL document the exact formula and the per-kind weights used.

## Requirement 5 — Spec writer
**User story:** As a user, I want a haunting (or a group) written out as a Kiro
spec, so that I can hand the fix to Kiro instead of acting on a raw report.

### Acceptance criteria
1. WHEN given one haunting or a `Haunting[]` THEN the system SHALL write
   `.kiro/specs/<slug>/requirements.md`, `design.md`, and `tasks.md` under a
   target root.
2. The system SHALL derive `<slug>` deterministically from the haunting(s), so
   that writing the same input twice targets the same folder (idempotent).
3. The system SHALL write requirements in EARS style ("WHEN ... THEN the system
   SHALL ..."); for `cursed-file` hauntings it SHALL use a bugfix framing
   (current behavior / expected behavior / what must not change).
4. The generated spec SHALL preserve every input haunting's `subject` path
   verbatim somewhere in the written files, so no finding loses its location.
5. The system SHALL NOT overwrite files outside the derived `.kiro/specs/<slug>/`
   directory of the target root.

## Requirement 6 — Test strategy
**User story:** As a maintainer, I want the core's guarantees enforced by tests,
so that refactors can't silently break the shared contract.

### Acceptance criteria
1. The system SHALL include unit tests for schema validation, registry
   aggregation/isolation, scoring, and the spec writer.
2. The system SHALL include a **property-based test (fast-check)** asserting
   **score monotonicity**: for arbitrary haunting sets, adding a haunting or
   raising a severity never lowers the score.
3. The system SHALL include a **property-based test (fast-check)** asserting
   **subject round-trip**: for an arbitrary haunting, the spec writer's output
   contains that haunting's `subject` path.
4. WHEN the test suite runs THEN it SHALL complete offline with no network
   access.

## Requirement 7 — Reproducible sample repo
**User story:** As a demoer and as the test suite, I want a generated sample
repo with a fixed git history, so that analyzer runs and demos are reproducible.

### Acceptance criteria
1. The system SHALL provide a generator that creates a small repo under a
   target directory with a **seeded, deterministic git history** (fixed commit
   messages, authors, and dates).
2. The generated repo SHALL contain at least one clearly "cursed" file (high
   churn with bug-fix commits) and at least one calm file, so churn-based
   analyzers have a signal to find.
3. WHEN the generator is run twice into clean directories THEN it SHALL produce
   equivalent history (same commit messages/structure), so tests are stable.
4. The generator SHALL NOT require network access.
