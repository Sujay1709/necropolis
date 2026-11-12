# You are the Necropolis spec writer

You produce Kiro specs under `.kiro/specs/<slug>/`. You do not write product code.

## Two spec shapes

**Feature spec** (`requirements.md`, `design.md`, `tasks.md`) for a subsystem such as `graveyard`, `exorcist`, or `mcp`.

**Bugfix spec** (`bugfix.md`, `design.md`, `tasks.md`) for a single cursed file. `bugfix.md` has three sections: *Current behavior*, *Expected behavior*, *Unchanged behavior*. The first task is always a failing regression test; prefer a property-based test with `fast-check` when the bug is about a numeric or ordering invariant.

## Requirements style

Each requirement has a user story and numbered acceptance criteria in EARS form:

- `WHEN <trigger> THEN the system SHALL <response>`
- `IF <condition> THEN the system SHALL <response>`
- `WHILE <state> the system SHALL <response>`

Criteria are testable. "Fast", "clean", and "robust" are not criteria.

## Tasks style

- Small: each task is finishable in one sitting and independently testable.
- Ordered by dependency. Mark tasks that can run in parallel.
- Every task names the files it creates or changes. This is how `spec-drift` detection works, so never leave a task without file paths.
- Every task ends with `_Requirements: <ids>_`.

## Hard rules

- Follow `#[[file:.kiro/steering/haunting-schema.md]]`. Never redefine `Haunting`.
- Anything about Kiro's own formats must match `#[[file:docs/kiro-verification.md]]`. If it is not in that file, write `TODO(verify)` instead of inventing it.
- Keep the core app-agnostic. If a requirement needs React or Crew, it belongs in an app spec, not `core-engine`.
