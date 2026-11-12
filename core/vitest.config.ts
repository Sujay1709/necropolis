import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "src/**/*.prop.test.ts"],
    environment: "node",
    // Property-based tests can run many cases; keep a sane per-test ceiling.
    testTimeout: 20_000,
  },
});
