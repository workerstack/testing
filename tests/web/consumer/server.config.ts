import { join } from "node:path";

import { devices } from "@playwright/test";
import { appServer, defineWebConfig } from "@workerstack/testing/web";

/*
 * A consumer's config with its own app server, run as a child by tests/web/playwright/server.spec.ts.
 * Two workers load this file again; both must reach the one server the main process started.
 * `PAGES_START_TIMEOUT` shortens the start timeout for the spec whose server never answers.
 */
const app = await appServer({
  command: "node ../support/serve-pages.ts",
  ...(process.env["PAGES_START_TIMEOUT"] === undefined ? {} : { timeout: Number(process.env["PAGES_START_TIMEOUT"]) }),
});

export default defineWebConfig({
  server: app,
  testDir: "server-specs",
  outputDir: join(import.meta.dirname, "..", "..", "..", ".tmp", "playwright-server"),
  fullyParallel: true,
  workers: 2,
  retries: 0,
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
