// NECROPOLIS core — public barrel.
//
// The core is app-agnostic: it must not import from apps/* or mcp/.
// It owns the shared pipeline: Analyzer[] -> Haunting[] -> score() / specWriter().
//
// Modules are filled in by the Phase 2 tasks (schema, analyzer contract,
// registry, scoring, spec writer). This placeholder keeps the package
// resolvable and type-checkable from task 1 onward.

/** Package marker; replaced by real exports as tasks land. */
export const CORE_PACKAGE = "@necropolis/core";
