import { describe, it, expect } from "vitest";
import { CORE_PACKAGE } from "./index.js";

describe("core scaffold smoke test", () => {
  it("exposes the package marker", () => {
    expect(CORE_PACKAGE).toBe("@necropolis/core");
  });
});
