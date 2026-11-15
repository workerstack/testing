import { escape, ssr } from "@solidjs/web"
import { afterEach, describe, expect, it } from "vitest"
import { renderServer } from "./server.ts"

const original = console.warn

afterEach(() => {
	console.warn = original
})

/* Compiled JSX calls `ssr` with the template's parts; these tests call it the same way. */
describe("renderServer", () => {
	it("renders on the server to HTML, escaping what the component put in", () => {
		const { html, warnings } = renderServer(() =>
			ssr(['<b data-x="', '">', "</b>"], escape("a&b", true), escape("<i>")),
		)
		expect(html).toBe('<b data-x="a&amp;b">&lt;i></b>')
		expect(warnings).toEqual([])
	})

	it("records what the render warned, and the console still prints it", () => {
		const printed: unknown[] = []
		console.warn = (...args: unknown[]) => printed.push(args.join(" "))
		const { warnings } = renderServer(() => {
			console.warn("written on the server")
			return ssr(["<p></p>"])
		})
		expect(warnings).toEqual(["written on the server"])
		expect(printed).toEqual(["written on the server"])
	})
})
