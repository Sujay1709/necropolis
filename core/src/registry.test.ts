import { describe, it, expect } from "vitest";
import { Registry, createRegistry } from "./registry.js";
import type { Analyzer } from "./analyzer.js";
import type { Haunting } from "./haunting.js";

function haunting(overrides: Partial<Haunting> = {}): Haunting {
  return {
    id: "id-" + (overrides.subject ?? "x"),
    kind: "cursed-file",
    severity: 0.5,
    subject: "src/x.ts",
    evidence: [],
    suggestedFix: "fix it",
    analyzer: "test",
    ...overrides,
  };
}

/** A fixed-output analyzer. Also serves as the task-4 "satisfies Analyzer" check. */
function fixed(name: string, out: Haunting[]): Analyzer {
  return { name, analyze: async () => out };
}

describe("Registry.register", () => {
  it("rejects duplicate names", () => {
    const r = new Registry();
    r.register(fixed("dup", []));
    expect(() => r.register(fixed("dup", []))).toThrowError(/already registered/);
  });

  it("tracks registration order in analyzerNames", () => {
    const r = createRegistry([fixed("a", []), fixed("b", [])]);
    expect(r.analyzerNames()).toEqual(["a", "b"]);
  });
});

describe("Registry.run — aggregation and ordering", () => {
  it("merges hauntings from multiple analyzers", async () => {
    const r = createRegistry([
      fixed("one", [haunting({ id: "1", subject: "a.ts" })]),
      fixed("two", [haunting({ id: "2", subject: "b.ts" })]),
    ]);
    const { hauntings, errors } = await r.run({ rootDir: "." });
    expect(errors).toEqual([]);
    expect(hauntings.map((h) => h.id)).toEqual(["1", "2"]);
  });

  it("returns [] hauntings when no analyzers registered", async () => {
    const { hauntings, errors } = await new Registry().run({ rootDir: "." });
    expect(hauntings).toEqual([]);
    expect(errors).toEqual([]);
  });

  it("orders deterministically by kind, then subject, then id", async () => {
    // Intentionally register out of order; output must be sorted.
    const r = createRegistry([
      fixed("z", [
        haunting({ id: "b", kind: "spec-drift", subject: "zzz.ts" }),
        haunting({ id: "a", kind: "cursed-file", subject: "mmm.ts" }),
      ]),
      fixed("y", [
        haunting({ id: "c", kind: "cursed-file", subject: "aaa.ts" }),
        haunting({ id: "d", kind: "cursed-file", subject: "mmm.ts" }),
      ]),
    ]);
    const { hauntings } = await r.run({ rootDir: "." });
    expect(hauntings.map((h) => [h.kind, h.subject, h.id])).toEqual([
      ["cursed-file", "aaa.ts", "c"],
      ["cursed-file", "mmm.ts", "a"],
      ["cursed-file", "mmm.ts", "d"],
      ["spec-drift", "zzz.ts", "b"],
    ]);
  });

  it("output order is independent of registration order", async () => {
    const h1 = haunting({ id: "1", kind: "cursed-file", subject: "a.ts" });
    const h2 = haunting({ id: "2", kind: "dead-hook", subject: "b.ts" });
    const a = await createRegistry([fixed("p", [h1]), fixed("q", [h2])]).run({
      rootDir: ".",
    });
    const b = await createRegistry([fixed("q", [h2]), fixed("p", [h1])]).run({
      rootDir: ".",
    });
    expect(a.hauntings).toEqual(b.hauntings);
  });
});

describe("Registry.run — isolation", () => {
  it("captures a throwing analyzer while others still return (Req 3.3)", async () => {
    const boom: Analyzer = {
      name: "boom",
      analyze: async () => {
        throw new Error("cursed");
      },
    };
    const r = createRegistry([
      fixed("ok", [haunting({ id: "1", subject: "a.ts" })]),
      boom,
    ]);
    const { hauntings, errors } = await r.run({ rootDir: "." });
    expect(hauntings.map((h) => h.id)).toEqual(["1"]);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.analyzer).toBe("boom");
    expect(errors[0]?.error.message).toContain("cursed");
  });

  it("non-Error throws are wrapped in an Error", async () => {
    const weird: Analyzer = {
      name: "weird",
      analyze: async () => {
        throw "string failure";
      },
    };
    const { errors } = await createRegistry([weird]).run({ rootDir: "." });
    expect(errors[0]?.error).toBeInstanceOf(Error);
    expect(errors[0]?.error.message).toContain("string failure");
  });

  it("a malformed haunting fails only its analyzer, not the run", async () => {
    const bad: Analyzer = {
      name: "bad",
      // severity out of range -> validateHaunting throws
      analyze: async () => [haunting({ severity: 5 })],
    };
    const r = createRegistry([
      fixed("good", [haunting({ id: "1", subject: "a.ts" })]),
      bad,
    ]);
    const { hauntings, errors } = await r.run({ rootDir: "." });
    expect(hauntings.map((h) => h.id)).toEqual(["1"]);
    expect(errors[0]?.analyzer).toBe("bad");
    expect(errors[0]?.error.message).toMatch(/severity/);
  });
});
