// NECROPOLIS core — public barrel.
//
// The core is app-agnostic: it must not import from apps/* or mcp/.
// It owns the shared pipeline: Analyzer[] -> Haunting[] -> score() / specWriter().
//
// Remaining modules (analyzer contract, registry, scoring, spec writer) are
// filled in by the later Phase 2 tasks.

/** Package marker. */
export const CORE_PACKAGE = "@necropolis/core";

export {
  HAUNTING_KINDS,
  HauntingValidationError,
  isHaunting,
  isHauntingKind,
  validateHaunting,
  type Haunting,
  type HauntingKind,
} from "./haunting.js";

export {
  hauntingId,
  kebab,
  shortHash,
  slugFor,
  type HauntingIdParts,
} from "./slug.js";
