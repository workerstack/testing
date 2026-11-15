import { defineConfig, devices } from "@playwright/test"
import { join } from "node:path"

/*
 * A consumer's Playwright project, run as a child by tests/web/playwright/consumer.spec.ts. Its
 * output has its own directory, since the outer run clears `.tmp/playwright` when it starts.
 */
export default defineConfig({
	testDir: "specs",
	outputDir: join(import.meta.dirname, "..", "..", "..", ".tmp", "playwright-consumer"),
	forbidOnly: true,
	retries: 0,
	projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
})
