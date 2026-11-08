import { describe, expect, it } from "vitest"
import { rule } from "./no-v8-ignore.ts"
import { oxlintReports, reportsOf } from "./rule-harness.ts"

describe("testing/no-v8-ignore", () => {
	it("flags v8, c8 and istanbul ignore hints anywhere", () => {
		const fixture = {
			"src/api/a.ts": "/* v8 ignore next */\nexport const a = 1\n// c8 ignore start\n/* istanbul ignore else */\n",
			"tests/b.test.ts": "/* V8 Ignore next */\n",
		}
		expect(reportsOf(rule, fixture).map(({ file, line }) => `${file}:${line}`)).toEqual([
			"src/api/a.ts:1",
			"src/api/a.ts:3",
			"src/api/a.ts:4",
			"tests/b.test.ts:1",
		])
	})

	it("leaves other comments alone", () => {
		expect(reportsOf(rule, { "src/api/a.ts": "// ignore this\n/* v8 is fast */\n" })).toEqual([])
	})

	it("fails oxlint through the testing plugin entry", () => {
		expect(oxlintReports("no-v8-ignore", { "src/api/a.ts": "/* v8 ignore next */\nexport const a = 1\n" }).length).toBe(
			1,
		)
	})
})
