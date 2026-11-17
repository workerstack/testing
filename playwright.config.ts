import { defineConfig, devices } from "@playwright/test";

// The Playwright half of `bun run test:web`: page-level fixtures against tests/web/pages. The site
// each worker serves picks its own port (tests/web/support/site.ts), so there is no webServer, no
// fixed port and no retry to hide a collision.
export default defineConfig({
  forbidOnly: process.env["CI"] !== undefined,
  outputDir: ".tmp/playwright",
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  reporter: "list",
  retries: 0,
  testDir: "tests/web/playwright",
});
