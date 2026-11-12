// Deterministic id and slug helpers.
//
// Stable ids/slugs make re-running idempotent: the same finding always yields
// the same Haunting id, and writing the same input always targets the same
// spec folder. Uses node:crypto only (no runtime dependency).

import { createHash } from "node:crypto";
import type { HauntingKind } from "./haunting.js";

/** First 8 hex chars of the SHA-256 of `input`. Stable and deterministic. */
export function shortHash(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex").slice(0, 8);
}

/**
 * Kebab-case a string into a filesystem-safe token.
 *
 * Lowercases, replaces any run of non-alphanumeric characters with a single
 * hyphen, and trims leading/trailing hyphens. Returns "x" for input that is
 * empty after normalization, so a slug is never an empty path segment.
 */
export function kebab(input: string): string {
  const out = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return out.length > 0 ? out : "x";
}

/** The stable-id inputs: the fields that identify a finding. */
export interface HauntingIdParts {
  analyzer: string;
  kind: HauntingKind;
  subject: string;
}

/**
 * Compute a stable Haunting id from the identifying fields.
 *
 * The id depends only on {analyzer, kind, subject} — not on severity, evidence,
 * or suggestedFix — so re-analysis of unchanged input yields the same id even
 * if the severity or wording drifts (Req 1.4). A NUL separator avoids
 * collisions between differently-split fields.
 */
export function hauntingId(parts: HauntingIdParts): string {
  const key = `${parts.analyzer}\u0000${parts.kind}\u0000${parts.subject}`;
  return shortHash(key);
}

/**
 * Deterministic spec-folder slug for one haunting or a group (Req 5.2).
 *
 * - A single haunting -> `<kind>-<shortHash(subject)>`.
 * - A group -> `necropolis-<shortHash(sorted ids)>`.
 *
 * Both are kebab-cased and filesystem-safe, and are order-independent for
 * groups (ids are sorted before hashing), so the same set always maps to the
 * same slug.
 */
export function slugFor(
  input:
    | { id: string; kind: HauntingKind; subject: string }
    | ReadonlyArray<{ id: string }>,
): string {
  if (Array.isArray(input)) {
    // A group is identified by its (order-independent) set of ids.
    const ids = input.map((h) => h.id).sort();
    return `necropolis-${shortHash(ids.join("\u0000"))}`;
  }
  const single = input as { kind: HauntingKind; subject: string };
  return `${kebab(single.kind)}-${shortHash(single.subject)}`;
}
