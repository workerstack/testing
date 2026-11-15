import { createServer } from "node:net"
import solid from "@solidjs/vite-plugin"
import { playwright } from "@vitest/browser-playwright"
import { solidHydration } from "@workerstack/testing/web/solid/vitest"
import { defineConfig } from "vitest/config"

/*
 * An app's hydration project, run as a child by tests/web/playwright/solid-consumer.spec.ts with
 * the packed package in its own node_modules: one Solid plugin compiles for the browser, and
 * `solidHydration` renders the same fixtures on the server.
 */

const port = await new Promise<number>((resolve) => {
	const server = createServer().listen(0, () => {
		const { port: free } = server.address() as { port: number }
		server.close(() => resolve(free))
	})
})

export default defineConfig({
	plugins: [solid({ refresh: false, solid: { hydratable: true } }), solidHydration()],
	test: {
		include: ["*.test.tsx"],
		api: { port },
		browser: { enabled: true, headless: true, instances: [{ browser: "chromium" }], provider: playwright() },
	},
})
