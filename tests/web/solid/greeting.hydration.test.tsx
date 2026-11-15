import { hydrator } from "@workerstack/testing/web/solid"
import { describe, expect, it } from "vitest"
import { page, userEvent } from "vitest/browser"
import { Greeting, Mismatch } from "./greeting.fixture.tsx"

/* The built `./web/solid` in Chromium: server HTML from node, hydrated by the same fixtures. */
const hydrate = hydrator(new URL("./greeting.fixture.tsx", import.meta.url), { Greeting, Mismatch })

describe("hydrator", () => {
	it("claims the server's nodes, and the hydrated handler updates the server's button", async () => {
		const view = await hydrate("Greeting")
		expect(view.mismatches).toEqual({})
		expect(view.server.html).toContain("Hello &amp; welcome")
		const server = view.container.querySelector("button")
		await userEvent.click(page.getByRole("button", { name: "Clicked 0" }))
		await expect.element(page.getByRole("button", { name: "Clicked 1" })).toBeInTheDocument()
		expect(view.container.querySelector("button")).toBe(server)
	})

	it("reports the element the client expected where the server rendered another", async () => {
		const view = await hydrate("Mismatch")
		expect(view.mismatches).toEqual({
			warnings: ['Hydration tag mismatch for key "1": expected <i> but found <b _hk="1" data-slot="server">'],
		})
	})

	it("leaves the page as it found it once disposed", async () => {
		expect("_$HY" in window).toBe(false)
		const view = await hydrate("Greeting")
		expect("_$HY" in window).toBe(true)
		view.dispose()
		expect([view.container.isConnected, "_$HY" in window]).toEqual([false, false])
	})
})
