// The analyzer registry.
//
// Each app registers the analyzers it wants and runs them over one root. The
// registry aggregates results with deterministic ordering, isolates per-analyzer
// failures, and validates every returned haunting so a misbehaving analyzer
// cannot inject a malformed record.

import type { Analyzer, AnalyzerContext } from "./analyzer.js";
import { validateHaunting, type Haunting } from "./haunting.js";

/** A failure captured from one analyzer during a run. */
export interface AnalyzerError {
  /** Name of the analyzer that failed. */
  analyzer: string;
  /** The error it produced (schema violations included). */
  error: Error;
}

/** The outcome of running the registry over one root. */
export interface RunResult {
  /** All hauntings from all analyzers, in deterministic order. */
  hauntings: Haunting[];
  /** Per-analyzer failures; an empty array means every analyzer succeeded. */
  errors: AnalyzerError[];
}

/**
 * Deterministic ordering key: `kind`, then `subject`, then `id`.
 * Documented so both apps (and tests) can rely on stable output (Req 3.2).
 */
function compareHauntings(a: Haunting, b: Haunting): number {
  if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
  if (a.subject !== b.subject) return a.subject < b.subject ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

function toError(e: unknown): Error {
  return e instanceof Error ? e : new Error(String(e));
}

/** A collection of analyzers run together over a single project root. */
export class Registry {
  readonly #analyzers = new Map<string, Analyzer>();

  /**
   * Register an analyzer. Throws if another analyzer with the same `name`
   * is already registered (Req 3.4).
   */
  register(analyzer: Analyzer): this {
    if (this.#analyzers.has(analyzer.name)) {
      throw new Error(`Analyzer "${analyzer.name}" is already registered`);
    }
    this.#analyzers.set(analyzer.name, analyzer);
    return this;
  }

  /** The names of the registered analyzers, in registration order. */
  analyzerNames(): string[] {
    return [...this.#analyzers.keys()];
  }

  /**
   * Run every registered analyzer over `ctx` and aggregate the results.
   *
   * - Analyzers run concurrently; a throw from one is captured into `errors`
   *   and does not abort the others (Req 3.3).
   * - Every returned haunting is passed through `validateHaunting`; a malformed
   *   record turns into an `AnalyzerError` for that analyzer rather than
   *   contaminating the output.
   * - Output is sorted by {@link compareHauntings} for deterministic order.
   */
  async run(ctx: AnalyzerContext): Promise<RunResult> {
    const analyzers = [...this.#analyzers.values()];

    const settled = await Promise.all(
      analyzers.map(async (a): Promise<AnalyzerError | Haunting[]> => {
        try {
          const raw = await a.analyze(ctx);
          // Validate each haunting; a bad one fails just this analyzer.
          return raw.map((h) => validateHaunting(h));
        } catch (e) {
          return { analyzer: a.name, error: toError(e) };
        }
      }),
    );

    const hauntings: Haunting[] = [];
    const errors: AnalyzerError[] = [];
    for (const result of settled) {
      if (Array.isArray(result)) hauntings.push(...result);
      else errors.push(result);
    }

    hauntings.sort(compareHauntings);
    return { hauntings, errors };
  }
}

/** Convenience: build a registry from a list of analyzers. */
export function createRegistry(analyzers: ReadonlyArray<Analyzer> = []): Registry {
  const registry = new Registry();
  for (const a of analyzers) registry.register(a);
  return registry;
}
