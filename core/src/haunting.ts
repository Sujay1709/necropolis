// The one shared Haunting schema.
//
// Every analyzer in every app emits this exact shape, so scoring, presentation,
// and the spec writer work identically regardless of which analyzer produced
// the finding. See .kiro/steering/structure.md ("core stays app-agnostic").

/** The fixed, documented set of haunting kinds NECROPOLIS detects. */
export const HAUNTING_KINDS = [
  "cursed-file",
  "steering-conflict",
  "dead-hook",
  "over-budget",
  "spec-drift",
  "legacy-config",
] as const;

export type HauntingKind = (typeof HAUNTING_KINDS)[number];

/** One detected problem in a codebase (or a project's .kiro/ config). */
export interface Haunting {
  /** Stable id for this finding. Same underlying finding -> same id. */
  id: string;
  /** Which kind of haunting this is. */
  kind: HauntingKind;
  /** How bad it is, in the inclusive range [0, 1]. */
  severity: number;
  /** The path the haunting is about (a file or a .kiro artifact). */
  subject: string;
  /** Human-readable bullet points backing the finding. */
  evidence: string[];
  /** A one-paragraph proposed fix. */
  suggestedFix: string;
  /** Name of the analyzer that produced this haunting. */
  analyzer: string;
}

const KIND_SET: ReadonlySet<string> = new Set(HAUNTING_KINDS);

/** Type guard for {@link HauntingKind}. */
export function isHauntingKind(value: unknown): value is HauntingKind {
  return typeof value === "string" && KIND_SET.has(value);
}

/**
 * Error thrown when a candidate object is not a valid {@link Haunting}.
 * The message names the first offending field (Req 1.3).
 */
export class HauntingValidationError extends Error {
  /** The field that failed validation. */
  readonly field: string;
  constructor(field: string, detail: string) {
    super(`Invalid Haunting: ${field} ${detail}`);
    this.name = "HauntingValidationError";
    this.field = field;
  }
}

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function isStringArray(x: unknown): x is string[] {
  return Array.isArray(x) && x.every((e) => typeof e === "string");
}

/**
 * Validate an unknown value as a {@link Haunting}.
 *
 * Returns the value typed as `Haunting` when valid. Throws
 * {@link HauntingValidationError} naming the first offending field otherwise.
 * `severity` must be a finite number in the inclusive range [0, 1] (Req 1.2).
 */
export function validateHaunting(candidate: unknown): Haunting {
  if (!isPlainObject(candidate)) {
    throw new HauntingValidationError("(root)", "must be an object");
  }

  const { id, kind, severity, subject, evidence, suggestedFix, analyzer } =
    candidate;

  if (typeof id !== "string" || id.length === 0) {
    throw new HauntingValidationError("id", "must be a non-empty string");
  }
  if (!isHauntingKind(kind)) {
    throw new HauntingValidationError(
      "kind",
      `must be one of: ${HAUNTING_KINDS.join(", ")}`,
    );
  }
  if (typeof severity !== "number" || !Number.isFinite(severity)) {
    throw new HauntingValidationError("severity", "must be a finite number");
  }
  if (severity < 0 || severity > 1) {
    throw new HauntingValidationError("severity", "must be within [0, 1]");
  }
  if (typeof subject !== "string" || subject.length === 0) {
    throw new HauntingValidationError("subject", "must be a non-empty string");
  }
  if (!isStringArray(evidence)) {
    throw new HauntingValidationError("evidence", "must be an array of strings");
  }
  if (typeof suggestedFix !== "string") {
    throw new HauntingValidationError("suggestedFix", "must be a string");
  }
  if (typeof analyzer !== "string" || analyzer.length === 0) {
    throw new HauntingValidationError("analyzer", "must be a non-empty string");
  }

  return { id, kind, severity, subject, evidence, suggestedFix, analyzer };
}

/** Boolean form of {@link validateHaunting} for callers that prefer it. */
export function isHaunting(candidate: unknown): candidate is Haunting {
  try {
    validateHaunting(candidate);
    return true;
  } catch {
    return false;
  }
}
