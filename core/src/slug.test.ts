import { describe, it, expect } from "vitest";
import { hauntingId, kebab, shortHash, slugFor } from "./slug.js";
import type { HauntingKind } from "./haunting.js";

describe("shortHash", () => {
  it("is deterministic and 8 hex chars", () => {
    const a = shortHash("src/haunted.ts");
    expect(a).toBe(shortHash("src/haunted.ts"));
    expect(a).toMatch(/^[0-9a-f]{8}$/);
  });
  it("differs for different input", () => {
    expect(shortHash("a")).not.toBe(shortHash("b"));
  });
});

describe("kebab", () => {
  it("lowercases and hyphenates non-alphanumerics", () => {
    expect(kebab("Cursed File!")).toBe("cursed-file");
    expect(kebab("src/Foo_Bar.ts")).toBe("src-foo-bar-ts");
  });
  it("trims leading/trailing separators and never returns empty", () => {
    expect(kebab("  --x--  ")).toBe("x");
    expect(kebab("///")).toBe("x");
    expect(kebab("")).toBe("x");
  });
});

describe("hauntingId", () => {
  const base = {
    analyzer: "git-churn",
    kind: "cursed-file" as HauntingKind,
    subject: "src/haunted.ts",
  };

  it("is stable for identical identifying fields", () => {
    expect(hauntingId(base)).toBe(hauntingId({ ...base }));
  });
  it("changes when subject changes", () => {
    expect(hauntingId(base)).not.toBe(
      hauntingId({ ...base, subject: "src/calm.ts" }),
    );
  });
  it("changes when analyzer or kind changes", () => {
    expect(hauntingId(base)).not.toBe(
      hauntingId({ ...base, analyzer: "coverage" }),
    );
    expect(hauntingId(base)).not.toBe(
      hauntingId({ ...base, kind: "spec-drift" }),
    );
  });
  it("avoids field-boundary collisions", () => {
    // "a" + "bc" vs "ab" + "c" must not collide thanks to the separator.
    const x = hauntingId({ analyzer: "a", kind: "dead-hook", subject: "bc" });
    const y = hauntingId({ analyzer: "ab", kind: "dead-hook", subject: "c" });
    expect(x).not.toBe(y);
  });
});

describe("slugFor", () => {
  const single = {
    id: "deadbeef",
    kind: "cursed-file" as HauntingKind,
    subject: "src/haunted.ts",
  };

  it("single: <kind>-<hash(subject)> and is kebab-safe", () => {
    const s = slugFor(single);
    expect(s).toMatch(/^cursed-file-[0-9a-f]{8}$/);
    expect(s).toBe(slugFor({ ...single })); // idempotent
  });

  it("group: necropolis-<hash> and order-independent", () => {
    const a = slugFor([{ id: "a" }, { id: "b" }, { id: "c" }]);
    const b = slugFor([{ id: "c" }, { id: "a" }, { id: "b" }]);
    expect(a).toBe(b);
    expect(a).toMatch(/^necropolis-[0-9a-f]{8}$/);
  });

  it("different groups produce different slugs", () => {
    expect(slugFor([{ id: "a" }, { id: "b" }])).not.toBe(
      slugFor([{ id: "a" }, { id: "x" }]),
    );
  });
});
