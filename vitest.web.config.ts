import { playwright } from "@vitest/browser-playwright"
import { defineConfig } from "vitest/config"
import { freePort } from "./src/web/port.ts"

/*
 * The vitest half of `bun run test:web`: in-page helpers in real Chromium. The browser server takes
 * a port the OS picked, never vitest's fixed default, so two runs side by side never collide.
 */
export default defineConfig({
	test: {
		name: "web",
		include: ["tests/web/browser/**/*.test.ts"],
		api: { port: await freePort() },
		browser: {
			enabled: true,
			provider: playwright(),
			headless: true,
			instances: [{ browser: "chromium" }],
		},
	},
})
