import { test as base, type TestType } from "@playwright/test"
import { describe, expect, expectTypeOf, it } from "vitest"
import type { A11y, A11yOptions } from "./a11y.ts"
import type { GuardOptions } from "./guard.ts"
import type { Network } from "./network.ts"
import type { PagePointer } from "./pointer.ts"
import type { Ready } from "./ready.ts"
import { test } from "./test.ts"

describe("test", () => {
	it("is Playwright's test extended with the web fixtures, so a consumer extends it again", () => {
		expect(test).not.toBe(base)
		expect(test.extend).toBeTypeOf("function")
		expect(test.use).toBeTypeOf("function")
	})

	it("gives a test body the guard and a11y options, and the readiness, a11y, network and pointer helpers", () => {
		type Args = typeof test extends TestType<infer T, object> ? T : never
		expectTypeOf<Args["guard"]>().toEqualTypeOf<GuardOptions>()
		expectTypeOf<Args["ready"]>().toEqualTypeOf<Ready>()
		expectTypeOf<Args["a11yDefaults"]>().toEqualTypeOf<A11yOptions>()
		expectTypeOf<Args["a11y"]>().toEqualTypeOf<A11y>()
		expectTypeOf<Args["network"]>().toEqualTypeOf<Network>()
		expectTypeOf<Args["pointer"]>().toEqualTypeOf<PagePointer>()
	})
})
