import { defineConfig } from "vitest/config";

// The vitest half of `bun run test:web`. Each project is its own config file, because a project
// owns its Solid plugin only when it is alone in a config: in-page helpers in Chromium, Solid on
// the server in node, and server HTML hydrated in Chromium.
export default defineConfig({
  test: {
    projects: [
      "tests/web/vitest.browser.config.ts",
      "tests/web/vitest.solid-server.config.ts",
      "tests/web/vitest.solid-hydration.config.ts",
    ],
  },
});
