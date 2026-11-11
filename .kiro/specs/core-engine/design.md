# Design — Core Engine

## Overview
The core engine is a dependency-free TypeScript package (`core/`) that both
apps import. It owns the entire pipeline shape:

```
Analyzer[]  ->  registry.run({ rootDir })  ->  Haunting[]  ->  score()        (number 0-100)
                                                           \->  specWriter()   (.kiro/specs/<slug>/*)
```

`core/` imports nothing from `apps/*` and uses only Node built-ins
(`node:fs/promises`, `node:path`, `node:crypto`). No DOM, React, CLI parsing,
or Crew code. All I/O is confined to the spec writer and (later) the
app-owned analyzers — the schema, registry contract, and scoring are pure.

## Module layout (`core/src/`)
```
haunting.ts     Haunting type + kind literals + validateHaunting()
analyzer.ts     Analyzer interface + AnalyzerContext type
registry.ts     Registry: register(), run() with per-analyzer isolation
score.ts        score(hauntings) -> integer 0..100, with documented weights
spec-writer.ts  writeSpec(haunting | Haunting[], targetRoot) -> slug/paths
slug.ts         deterministic slug + id helpers (crypto hash of stable key)
index.ts        public barrel export
```

## Data model
```ts
export type HauntingKind =
  | "cursed-file" | "steering-conflict" | "dead-hook"
  | "over-budget" | "spec-drift" | "legacy-config";

export interface Haunting {
  id: string;            // stable hash of {analyzer, kind, subject}
  kind: HauntingKind;
  severity: number;      // [0,1], validated
  subject: string;       // path (file or .kiro artifact)
  evidence: string[];    // human-readable bullet points
  suggestedFix: string;  // one-paragraph proposed fix
  analyzer: string;      // producing analyzer name
}
```
`validateHaunting(x): Haunting` throws a descriptive `Error` naming the first
offending field. A narrower `isHaunting(x): boolean` is provided for callers
that prefer a boolean.

## Analyzer contract
```ts
export interface AnalyzerContext { rootDir: string; }
export interface Analyzer {
  name: string;
  analyze(ctx: AnalyzerContext): Promise<Haunting[]>;
}
```
Analyzers are implemented in the apps, not in core. Core only defines the
interface and guarantees nothing network-related is invoked by the registry.

## Registry
```ts
class Registry {
  register(a: Analyzer): void;             // throws on duplicate name
  async run(ctx): Promise<RunResult>;      // { hauntings, errors }
}
interface RunResult { hauntings: Haunting[]; errors: AnalyzerError[]; }
```
- `run` executes analyzers (order-independent) and merges results.
- **Isolation:** each analyzer is awaited inside try/catch; a throw is captured
  into `errors` and does not abort the run (Req 3.3).
- **Deterministic ordering:** merged hauntings are sorted by
  `kind` → `subject` → `id` before returning (Req 3.2).
- Each returned haunting is passed through `validateHaunting` so a misbehaving
  analyzer can't inject a malformed record.

## Scoring (deterministic + monotonic)
Lower is better; `score([]) === 0`. Per-kind base weight `w(kind)` reflects how
bad a kind is. A single haunting contributes:
```
contribution(h) = w(h.kind) * h.severity        // >= 0
raw            = sum over hauntings of contribution(h)
score          = round( 100 * (1 - exp(-raw / K)) )   // saturating, 0..100
```
- **Monotonic (Req 4.3):** `contribution(h) >= 0`, so adding a haunting only
  increases `raw`; `severity` appears with a positive coefficient, so raising it
  increases `raw`; `raw -> score` via `1 - exp(-raw/K)` is strictly increasing.
  Rounding is non-decreasing, so `score` never drops. (The property test asserts
  the `>=` form, which rounding preserves.)
- **Deterministic (Req 4.2):** sum is commutative; no ordering or randomness.
- `K` is a documented saturation constant chosen so a few severe hauntings push
  toward ~80–100 without any single one saturating the bar. Weights `w(kind)`
  and `K` live as named constants in `score.ts` and are documented inline.

## Spec writer
```ts
writeSpec(input: Haunting | Haunting[], targetRoot: string): Promise<{
  slug: string; dir: string; files: string[];
}>
```
- **Slug (Req 5.2):** derived deterministically. Single haunting →
  `<kind>-<shortHashOf(subject)>`; group → `necropolis-<shortHashOf(sorted ids)>`.
  Kebab-cased, filesystem-safe.
- Writes three files into `<targetRoot>/.kiro/specs/<slug>/`:
  - `requirements.md` — EARS acceptance criteria. For `cursed-file`, a bugfix
    framing (current / expected / must-not-change). Every input `subject` is
    emitted verbatim (Req 5.4) in an "Affected paths" list and inline.
  - `design.md` — summarizes evidence + suggestedFix per haunting.
  - `tasks.md` — small ordered checklist derived from the fixes.
- **Containment (Req 5.5):** the computed directory is resolved and asserted to
  be inside `<targetRoot>/.kiro/specs/`; writes outside are refused. The writer
  creates directories as needed and only writes these three files.

## Slug / id helpers
`shortHash(s)` = first 8 hex chars of SHA-256 (`node:crypto`), giving stable,
collision-resistant, deterministic ids and slugs with no dependency.

## Sample-repo generator (`examples/sample-repo/`)
A Node script that builds a repo under a target dir using `git` via
`node:child_process` with **pinned env** for determinism:
`GIT_AUTHOR_DATE` / `GIT_COMMITTER_DATE` set per commit, fixed author/email,
fixed messages. It seeds:
- `src/haunted.ts` — many commits, several messages containing "fix"/"bug".
- `src/calm.ts` — one or two commits, no bug-fix messages.
- a minimal coverage artifact so the (later) coverage analyzer has input.
Running twice into clean dirs yields equivalent history (Req 7.3). No network.

## Testing strategy
- **Unit (Vitest):** schema accept/reject; registry merge + isolation + dup
  name; `score([])===0`, known vectors; spec writer slug determinism, file
  creation, containment refusal.
- **Property (fast-check), `*.prop.test.ts`:**
  1. *Monotonicity* — arbitrary `Haunting[]`; adding any haunting or raising any
     severity yields `score' >= score`.
  2. *Subject round-trip* — arbitrary `Haunting`; writer output text contains
     `subject` verbatim. Uses a temp dir; cleaned up after.
- All tests run offline. The spec-writer tests write only under an OS temp dir.

## Key decisions / trade-offs
- **Zero runtime deps in core.** Hashing via `node:crypto`; git via
  `child_process` only in the generator (not in core, not in analyzers-at-core).
- **Saturating score** keeps the number in 0–100 while staying monotonic; the
  alternative (linear + clamp) is also monotonic but loses resolution once
  clamped. Documented constant `K` makes behavior tunable and testable.
- **Deterministic slugs/ids** make re-runs idempotent, which both apps rely on.

## Open questions / TODO (verify before Phase 2)
- Exact coverage file format Graveyard will consume (lcov vs json-summary) —
  decide in Phase 3; the generator currently emits a placeholder.
- Whether `over-budget` severity should scale with how far over Kiro's 32-file /
  100k-char limits an agent is — confirmed limits (tech.md), formula TBD in
  Exorcist phase.
