import solid from "@solidjs/vite-plugin"
import { defineProject } from "vitest/config"

/* Solid compiled for the server, rendering to a string in node, as an SSR app does. */
export default defineProject({
	plugins: [solid({ ssr: true })],
	test: { name: "solid-server", environment: "node", include: ["solid/**/*.server.test.tsx"] },
})
