import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts", "core/test/**/*.test.ts", "apps/**/test/**/*.test.ts", "mcp/test/**/*.test.ts"],
    testTimeout: 60_000,
  },
});
