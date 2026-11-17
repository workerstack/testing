import { join } from "node:path";

import { defineConfig, devices } from "@playwright/test";

// A consumer's Playwright project, run as a child by tests/web/playwright/consumer.spec.ts. Its
// output has its own directory, since the outer run clears `.tmp/playwright` when it starts.
export default defineConfig({
  forbidOnly: true,
  outputDir: join(import.meta.dirname, "..", "..", "..", ".tmp", "playwright-consumer"),
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  retries: 0,
  testDir: "specs",
});
