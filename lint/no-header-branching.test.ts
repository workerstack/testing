import { describe, expect, it } from "vitest"
import { rule } from "./no-header-branching.ts"
import { oxlintReports, reportsOf } from "./rule-harness.ts"

const MESSAGE =
	"credential placement comes from the operation's OpenAPI security (src/api/spec/security/); do not name an auth header or scheme prefix here"

describe("testing/no-header-branching", () => {
	it("flags an auth header name or a scheme prefix written outside the security modules", () => {
		const fixture = {
			"src/api/runtime/auth.ts": [
				'export const h = header ?? "authorization"',
				"export const v = `Bearer ${token}`",
				'export const w = "Basic " + encoded',
				'export const t = "Bearer {credential}"',
				'export const x = headers["Authorization"]',
				'export const y = name.toLowerCase() === "x-api-key"',
			].join("\n"),
		}
		expect(reportsOf(rule, fixture).map(({ line }) => line)).toEqual([1, 2, 3, 4, 5, 6])
		expect(reportsOf(rule, fixture)[0]?.message).toBe(MESSAGE)
	})

	it("allows the security, spec security and credentials modules, the reference server and tests", () => {
		const source = 'export const h = "authorization"\nexport const v = `Bearer ${t}`\n'
		const fixture = {
			"src/api/security/credential-names.ts": source,
			"src/api/spec/security/placement.ts": source,
			"src/api/credentials/store.ts": source,
			"src/api/client/credentials.ts": source,
			"src/api/reference/http/access.ts": source,
			"src/api/runtime/auth.test.ts": source,
			"tests/api/integration/auth.test.ts": source,
		}
		expect(reportsOf(rule, fixture)).toEqual([])
	})

	it("flags the self-test too, whose principals send credentials through recipes", () => {
		const source = 'export const h = "authorization"\nexport const v = `Bearer ${t}`\n'
		expect(reportsOf(rule, { "src/api/conformance/suites/tenant-scope.ts": source }).map(({ line }) => line)).toEqual([
			1, 2,
		])
	})

	it("leaves unrelated strings alone", () => {
		const source =
			'export const a = "content-type"\nexport const b = `Bearer`\nexport const c = "authorized"\nexport const d = tag`\\unicode`\n'
		expect(reportsOf(rule, { "src/api/runtime/a.ts": source })).toEqual([])
	})

	it("fails oxlint through the testing plugin entry", () => {
		const fixture = { "src/api/runtime/a.ts": 'export const h = "authorization"\n' }
		expect(oxlintReports("no-header-branching", fixture).length).toBe(1)
	})
})
