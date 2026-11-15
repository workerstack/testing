import { describe, expect, it } from "vitest"
import { oxlintReports, reportsOf } from "./rule-harness.ts"
import { rule, webImportAllowed } from "./web-boundaries.ts"

const MESSAGE =
	"a web module imports node builtins, web itself and its declared optional peers only (see AGENTS.md: dependency arrows)"

const DOM_MESSAGE =
	"a web/dom module runs in the page: it imports web/dom itself and vitest only (see AGENTS.md: dependency arrows)"

const PEERS: ReadonlySet<string> = new Set([
	"@playwright/test",
	"solid-js",
	"@solidjs/web",
	"@solidjs/vite-plugin",
	"vite",
	"parse5",
])

const allowed = (from: string, spec: string): boolean => webImportAllowed({ from, peers: PEERS, spec })

describe("webImportAllowed", () => {
	it("lets plain web import builtins, itself and a declared web peer", () => {
		expect(allowed("ready.ts", "node:fs")).toBe(true)
		expect(allowed("guard/console.ts", "../ready.ts")).toBe(true)
		expect(allowed("ready.ts", "@playwright/test")).toBe(true)
		expect(allowed("ready.ts", "@playwright/test/reporter")).toBe(true)
	})

	it("keeps plain web off the API tester, the Solid layer and Solid itself", () => {
		expect(allowed("ready.ts", "../api/index.ts")).toBe(false)
		expect(allowed("ready.ts", "./solid/hydrate.ts")).toBe(false)
		expect(allowed("ready.ts", "solid-js")).toBe(false)
		for (const solidOnly of ["@solidjs/web", "@solidjs/vite-plugin", "vite", "parse5"])
			expect(allowed("ready.ts", solidOnly)).toBe(false)
	})

	it("refuses a package that is not a web peer, and a web peer the manifest does not declare", () => {
		expect(allowed("ready.ts", "lodash")).toBe(false)
		expect(allowed("ready.ts", "postgres")).toBe(false)
		expect(allowed("a11y.ts", "@axe-core/playwright")).toBe(false)
		expect(allowed("ready.ts", "fs")).toBe(false)
	})

	it("lets the Solid layer import plain web, declared Solid, vite and parse5, never the API tester", () => {
		expect(allowed("solid/hydrate.ts", "../ready.ts")).toBe(true)
		expect(allowed("solid/hydrate.ts", "./tags.ts")).toBe(true)
		expect(allowed("solid/hydrate.ts", "solid-js")).toBe(true)
		expect(allowed("solid/hydrate.ts", "solid-js/web")).toBe(true)
		for (const name of ["@solidjs/web", "@solidjs/vite-plugin", "vite", "parse5"])
			expect(allowed("solid/vitest.ts", name)).toBe(true)
		expect(allowed("solid/hydrate.ts", "../../api/index.ts")).toBe(false)
		expect(webImportAllowed({ from: "solid/html.ts", peers: new Set(["solid-js"]), spec: "parse5" })).toBe(false)
	})

	it("keeps web/dom, which runs in the page, to itself and vitest", () => {
		const peers = new Set([...PEERS, "vitest"])
		const dom = (spec: string): boolean => webImportAllowed({ from: "dom/pointer.ts", peers, spec })
		expect(dom("./gesture.ts")).toBe(true)
		expect(dom("vitest")).toBe(true)
		expect(dom("../ready.ts")).toBe(false)
		expect(dom("../solid/hydrate.ts")).toBe(false)
		expect(dom("@playwright/test")).toBe(false)
		expect(dom("node:fs")).toBe(false)
		expect(allowed("pointer.ts", "./dom/gesture.ts")).toBe(true)
	})

	it("refuses a path that climbs out of web", () => {
		expect(allowed("ready.ts", "../../lint/ast.ts")).toBe(false)
		expect(allowed("ready.ts", "../cli/main.ts")).toBe(false)
	})
})

describe("testing/web-boundaries", () => {
	it("reports every import form under src/web, with the message", () => {
		const fixture = {
			"src/web/ready.ts": [
				'import type { A } from "../api/index.ts"',
				'export { b } from "solid-js"',
				'export const c = () => import("./solid/hydrate.ts")',
				'import { d } from "./guard.ts"',
				"export const e = (name: string) => import(name)",
			].join("\n"),
		}
		const reports = reportsOf(rule, fixture)
		expect(reports.map(({ line }) => line)).toEqual([1, 2, 3])
		expect(reports[0]?.message).toBe(MESSAGE)
	})

	it("names what web/dom may import when a dom module breaks it", () => {
		const reports = reportsOf(rule, { "src/web/dom/pointer.ts": 'import { test } from "@playwright/test"\n' })
		expect(reports.map(({ message }) => message)).toEqual([DOM_MESSAGE])
	})

	it("leaves tests, fixtures and code outside src/web alone", () => {
		const source = 'import { x } from "../api/index.ts"\n'
		const fixture = {
			"src/web/ready.test.ts": source,
			"src/web/__fixtures__/page.ts": source,
			"src/api/index.ts": 'import { x } from "lodash"\n',
			"tests/web/browser/runner.test.ts": source,
		}
		expect(reportsOf(rule, fixture)).toEqual([])
	})

	it("fails oxlint through the testing plugin entry", () => {
		const fixture = { "src/web/ready.ts": 'import { x } from "../api/index.ts"\n' }
		expect(oxlintReports("web-boundaries", fixture).map(({ message }) => message)).toEqual([MESSAGE])
	})
})
