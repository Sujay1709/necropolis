# Product — NECROPOLIS

## What it is
NECROPOLIS is a small shared **core engine** (the "skeleton") that finds
**hauntings** — recurring problems in a codebase — and turns them into Kiro
specs. Two distinct apps are built on that one core:

- **GRAVEYARD** (web app): scans any git repo and draws a tombstone map of
  "cursed" files. Tombstone height = churn (commits in last 90 days), glow =
  share of bug-fix commits, red tint = low test coverage. Clicking a tombstone
  shows the evidence and a **Generate Kiro bugfix spec** button that writes a
  spec into the repo's `.kiro/specs/`.
- **EXORCIST** (Kiro Crew app + standalone CLI): audits a project's `.kiro/`
  folder for hauntings — conflicting steering docs, dead/legacy hooks, agent
  resource lists over Kiro's limits, spec drift, legacy configs. Outputs a
  **haunting score** 0–100 (lower is better) and writes the fix as a Kiro spec.

## Why (the pitch)
The whole value for the **Skeleton Crew** category is *reuse*: one engine,
two very different apps. The pipeline is always the same —

```
Analyzer  ->  Haunting (one shared schema)  ->  Spec writer
```

Both apps differ **only** in which analyzers they run and how they present
results. Keeping the core small, clean, and well documented is the point.

## Who it's for
Developers and teams who want to find the scariest parts of a codebase (or the
decay in their own `.kiro/` config) and get an actionable, Kiro-native fix
instead of a dashboard they have to interpret.

## Non-goals
- Not a general static analyzer or linter. We detect a fixed, documented set
  of haunting kinds.
- Not a CI/coverage tool. We *read* existing coverage; we don't run test suites.
- No heavyweight charting library in Graveyard — hand-rolled SVG only.
- No cloud service, accounts, or telemetry. Everything runs offline/local.
- Not a replacement for human review — specs are drafts for a human to approve.

## Scope discipline (hackathon)
Two students, deadline **Dec 4, 2026 2:00 PM PT**. Build in phases; the core and
a deployed Graveyard come first. **Kill switch Nov 20:** if core + deployed
Graveyard are not working, drop Exorcist and ship a single app. Honesty over
ambition — anything not working is marked clearly in the README; never fake
output.
