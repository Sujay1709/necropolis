import { describe, it, expect } from "vitest";
import {
  HAUNTING_KINDS,
  HauntingValidationError,
  isHaunting,
  isHauntingKind,
  validateHaunting,
  type Haunting,
} from "./haunting.js";

function valid(overrides: Partial<Haunting> = {}): Haunting {
  return {
    id: "abc123",
    kind: "cursed-file",
    severity: 0.5,
    subject: "src/haunted.ts",
    evidence: ["12 commits in 90 days", "7 contain 'fix'"],
    suggestedFix: "Add regression tests and split the file.",
    analyzer: "git-churn",
    ...overrides,
  };
}

describe("isHauntingKind", () => {
  it("accepts every declared kind", () => {
    for (const k of HAUNTING_KINDS) expect(isHauntingKind(k)).toBe(true);
  });
  it("rejects unknown or non-string values", () => {
    expect(isHauntingKind("ghost")).toBe(false);
    expect(isHauntingKind(42)).toBe(false);
    expect(isHauntingKind(undefined)).toBe(false);
  });
});

describe("validateHaunting — valid input", () => {
  it("returns the haunting unchanged", () => {
    const h = valid();
    expect(validateHaunting(h)).toEqual(h);
  });
  it("accepts severity at the inclusive bounds 0 and 1", () => {
    expect(validateHaunting(valid({ severity: 0 })).severity).toBe(0);
    expect(validateHaunting(valid({ severity: 1 })).severity).toBe(1);
  });
  it("accepts an empty evidence array", () => {
    expect(validateHaunting(valid({ evidence: [] })).evidence).toEqual([]);
  });
  it("accepts an empty suggestedFix string", () => {
    expect(validateHaunting(valid({ suggestedFix: "" })).suggestedFix).toBe("");
  });
});

describe("validateHaunting — rejects and names the offending field", () => {
  const cases: Array<[string, unknown]> = [
    ["(root)", null],
    ["(root)", "not an object"],
    ["(root)", []],
    ["id", valid({ id: "" })],
    ["kind", { ...valid(), kind: "poltergeist" }],
    ["severity", { ...valid(), severity: Number.NaN }],
    ["severity", { ...valid(), severity: Infinity }],
    ["severity", { ...valid(), severity: -0.01 }],
    ["severity", { ...valid(), severity: 1.01 }],
    ["subject", valid({ subject: "" })],
    ["evidence", { ...valid(), evidence: "not an array" }],
    ["evidence", { ...valid(), evidence: [1, 2, 3] }],
    ["suggestedFix", { ...valid(), suggestedFix: 123 }],
    ["analyzer", valid({ analyzer: "" })],
  ];

  for (const [field, input] of cases) {
    it(`rejects bad ${field}`, () => {
      expect(() => validateHaunting(input)).toThrowError(
        HauntingValidationError,
      );
      try {
        validateHaunting(input);
      } catch (e) {
        expect((e as HauntingValidationError).field).toBe(field);
      }
    });
  }
});

describe("isHaunting", () => {
  it("is true for valid, false for invalid", () => {
    expect(isHaunting(valid())).toBe(true);
    expect(isHaunting(valid({ severity: 2 }))).toBe(false);
    expect(isHaunting(null)).toBe(false);
  });
});
