import { renderServer, tag, tags, text } from "@workerstack/testing/web/solid"
import { describe, expect, it, vi } from "vitest"
import { Greeting, Warns } from "./greeting.fixture.tsx"

/* The built `./web/solid` in node, rendering JSX compiled for the server. */
describe("renderServer", () => {
	it("renders a component to the HTML a server sends, read with a real parser", () => {
		const { html, warnings } = renderServer(() => <Greeting />)
		expect(tag(html, { "data-slot": "greeting" }).name).toBe("p")
		expect(tag(html, "button").attrs["type"]).toBe("button")
		expect(tags(html, "span").map((span) => span.text)).toEqual(["Hello & welcome"])
		expect(text(html)).toBe("Clicked 0Hello & welcome")
		expect(warnings).toEqual([])
	})

	it("records a warning the render logged, and the console still prints it", () => {
		const print = vi.spyOn(console, "warn").mockImplementation(() => undefined)
		expect(renderServer(() => <Warns />).warnings).toEqual(["rendered with a warning"])
		expect(print).toHaveBeenCalledWith("rendered with a warning")
		print.mockRestore()
	})
})
