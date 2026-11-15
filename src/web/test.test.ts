import { test as base, type TestType } from "@playwright/test"
import { describe, expect, expectTypeOf, it } from "vitest"
import type { GuardOptions } from "./guard.ts"
import type { Ready } from "./ready.ts"
import { test } from "./test.ts"

describe("test", () => {
	it("is Playwright's test extended with the web fixtures, so a consumer extends it again", () => {
		expect(test).not.toBe(base)
		expect(test.extend).toBeTypeOf("function")
		expect(test.use).toBeTypeOf("function")
	})

	it("gives a test body the guard option and the readiness helpers", () => {
		type Args = typeof test extends TestType<infer T, object> ? T : never
		expectTypeOf<Args["guard"]>().toEqualTypeOf<GuardOptions>()
		expectTypeOf<Args["ready"]>().toEqualTypeOf<Ready>()
	})
})
