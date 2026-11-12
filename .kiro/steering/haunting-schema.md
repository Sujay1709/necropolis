---
inclusion: fileMatch
fileMatchPattern: ["core/**/*.ts", "apps/**/*.ts", "apps/**/*.tsx", "mcp/**/*.ts"]
---

# The Haunting schema (shared contract)

Every analyzer in every app produces the same shape. Do not add app-specific fields; put extra evidence in `evidence`.

```ts
export type HauntingKind =
  | "cursed-file"        // Graveyard: churn + bug-fix share + low coverage
  | "steering-conflict"  // Exorcist: two steering docs contradict
  | "dead-hook"          // Exorcist: hook command/script missing, or legacy trigger name
  | "over-budget"        // Exorcist: agent resources exceed Kiro load limits
  | "spec-drift"         // Exorcist: task marked done, named file missing
  | "legacy-config";     // Exorcist: CLI 2.x fields (allowedTools, toolsSettings, ...)

export interface Haunting {
  id: string;            // stable: `${kind}:${subject}` hashed, see design.md
  kind: HauntingKind;
  severity: number;      // 0..1, 1 is worst. Must be finite.
  subject: string;       // path relative to rootDir, POSIX separators
  evidence: string[];    // human-readable, one fact per entry, sorted
  suggestedFix: string;  // one sentence, imperative
  analyzer: string;      // name of the analyzer that produced it
}

export interface AnalyzeContext {
  rootDir: string;       // absolute path of the repo being analyzed
  now?: Date;            // injected for determinism; analyzers never call Date.now()
}

export interface Analyzer {
  name: string;          // kebab-case, unique
  kinds: HauntingKind[]; // kinds this analyzer can emit
  analyze(ctx: AnalyzeContext): Promise<Haunting[]>;
}
```

Rules that every implementation must keep:

- `score(hauntings)` is deterministic and **monotonic**: adding a haunting, or raising any severity, never lowers the score.
- `specWriter` preserves `subject` verbatim in the generated spec. A property test checks the round trip.
- Output arrays are sorted by `severity` descending, then `subject` ascending.
