import { defineConfig, devices } from "@playwright/test";

/*
 * The Playwright half of `bun run test:web`: page-level fixtures against tests/web/pages. The site
 * each worker serves picks its own port (tests/web/support/site.ts), so there is no webServer, no
 * fixed port and no retry to hide a collision.
 */
export default defineConfig({
  testDir: "tests/web/playwright",
  outputDir: ".tmp/playwright",
  forbidOnly: process.env["CI"] !== undefined,
  retries: 0,
  reporter: "list",
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
