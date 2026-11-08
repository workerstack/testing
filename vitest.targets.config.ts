import { defineConfig } from "vitest/config"

/*
 * Real-API targets: each one's compose stack from pinned images, prepared and run once. Docker and
 * network required, minutes per target, so it stays out of `test`; CI runs it nightly.
 */
export default defineConfig({
	test: {
		globalSetup: ["tests/api/support/temp-root.ts"],
		include: ["tests/api/targets/run.test.ts"],
		testTimeout: 60_000,
		hookTimeout: 900_000,
		fileParallelism: false,
	},
})
