import { defineConfig } from "vitest/config";

// The packed package, installed into a temp consumer and driven through its bin. Run after a build
// (`bun run test:e2e` builds first); slow by nature, so it stays out of `test`.
export default defineConfig({
  test: {
    fileParallelism: false,
    globalSetup: ["tests/api/support/temp-root.ts"],
    hookTimeout: 300_000,
    include: ["tests/api/e2e/**/*.test.ts"],
    testTimeout: 240_000,
  },
});
