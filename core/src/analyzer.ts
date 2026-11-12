// The Analyzer contract.
//
// An analyzer inspects a root directory and returns Haunting[]. Analyzers are
// implemented in the apps (Graveyard, Exorcist), never in core — core only
// defines the interface so the same analyzer can run from either app.
//
// Hard rule (see .kiro/steering/tech.md): analyzers run fully offline. They may
// read the filesystem and local git state under `rootDir`, but must make no
// network calls.

import type { Haunting } from "./haunting.js";

/** Input handed to every analyzer. */
export interface AnalyzerContext {
  /** Absolute or relative path to the root of the project being analyzed. */
  rootDir: string;
}

/** A named unit that turns a project root into a set of hauntings. */
export interface Analyzer {
  /** Unique identifier; also recorded as `Haunting.analyzer`. */
  name: string;
  /**
   * Inspect `ctx.rootDir` and resolve to schema-valid hauntings (possibly
   * empty). Must reject if `rootDir` is missing/unreadable rather than
   * returning partial or garbage results (Req 2.4).
   */
  analyze(ctx: AnalyzerContext): Promise<Haunting[]>;
}
