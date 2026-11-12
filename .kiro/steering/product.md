---
inclusion: always
---

# Necropolis: product

Necropolis finds the "hauntings" in a software project and turns each one into a Kiro spec that a developer can review and let Kiro implement.

## The two kinds of haunting

1. **Cursed files.** A few files keep breaking, get patched, and break again. Nobody has a map of them. Signals: high churn, a high share of bug-fix commits, low test coverage, many authors.
2. **Haunted AI configuration.** A project's `.kiro/` folder has drifted: hooks that use CLI 2.x trigger names or point at commands that no longer exist, agents whose `resources` exceed Kiro's load limits, steering docs that contradict each other, specs whose tasks are marked done with no matching code.

## One skeleton, two apps (Kiroween "Skeleton Crew" category)

- `core/` is the skeleton: `Analyzer -> Haunting -> score -> specWriter`. It knows nothing about any UI or about Kiro Crew.
- **Graveyard** (`apps/graveyard/`): a static web app. Scans a git repo and draws a tombstone map of cursed files. Clicking a tombstone generates a Kiro **bugfix spec** for that file.
- **Exorcist** (`apps/exorcist/`): a Kiro Crew app plus a plain CLI. Audits `.kiro/` and reports a **haunting score** (0 to 100, lower is better), then writes the fixes as a Kiro **feature spec**.

The two apps differ only in which analyzers they run and how they present results. That reuse is the whole pitch, so the core must stay small, documented, and app-agnostic.

## Users

- A developer on a mid-sized repo who wants to know which files deserve a refactor or a regression test before the next incident.
- A Kiro user whose `.kiro/` folder was set up months ago and may be silently misconfigured.
- Hackathon judges, who must be able to run both apps on the bundled sample repo in under a minute each.

## Non-goals (for the Dec 4, 2026 deadline)

- No hosted backend, accounts, or telemetry. Everything runs locally and offline.
- No language-specific static analysis. Signals come from git history, a coverage summary file, and `.kiro/` files.
- No automatic code changes. Necropolis writes specs; a human reviews them and Kiro implements them.
- The MCP server (`mcp/`) is optional and comes last.

## Honesty rule

If a feature does not work, the README says so. Demo output is never faked. The sample repo is clearly labeled as generated.
