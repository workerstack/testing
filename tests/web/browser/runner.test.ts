import { server } from "vitest/browser"
import { describe, expect, it } from "vitest"

describe("the vitest browser project", () => {
	it("runs in Chromium", () => {
		expect(server.browser).toBe("chromium")
	})

	it("lays out a real DOM", () => {
		const box = document.createElement("div")
		box.style.width = "120px"
		box.style.height = "10px"
		document.body.append(box)
		expect(box.getBoundingClientRect().width).toBe(120)
		box.remove()
	})
})
