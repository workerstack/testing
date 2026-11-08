import { describe, expect, it } from "vitest"
import { UsageError } from "../../errors/usage-error.ts"
import { assertVersion } from "./version.ts"

describe("assertVersion", () => {
	it("accepts OpenAPI 3.0, 3.1 and 3.2, patch and pre-release alike", () => {
		for (const openapi of ["3.0", "3.0.3", "3.1.0", "3.2.0", "3.1.1-rc1"]) {
			expect(() => assertVersion({ openapi }, "s")).not.toThrow()
		}
	})

	it("refuses Swagger 2 as the caller's to convert, naming the versions the API tester reads", () => {
		const refusal = new UsageError(
			"testing api: s is Swagger 2.0; the API tester reads OpenAPI 3.0–3.2 only — convert it first",
		)
		expect(() => assertVersion({ swagger: "2.0" }, "s")).toThrow(refusal)
		expect(() => assertVersion({ swagger: "2.0" }, "s")).toThrow(UsageError)
		/* YAML reads an unquoted `swagger: 2.0` as a number. */
		expect(() => assertVersion({ swagger: 2 }, "s")).toThrow(
			"testing api: s is Swagger 2; the API tester reads OpenAPI 3.0–3.2 only",
		)
	})

	it("refuses an OpenAPI version below 3.0 or newer than 3.2, naming it", () => {
		for (const openapi of ["2.0", "1.0.0", "3.3.0", "3.10", "4.0.0", "3"]) {
			expect(() => assertVersion({ openapi }, "s")).toThrow(
				new UsageError(`testing api: s is OpenAPI ${openapi}; the API tester reads OpenAPI 3.0–3.2 only`),
			)
			expect(() => assertVersion({ openapi }, "s")).toThrow(UsageError)
		}
	})

	it("refuses a document with no version string as not an OpenAPI document", () => {
		for (const doc of [{}, { openapi: 3 }]) {
			let thrown: unknown
			try {
				assertVersion(doc, "s")
			} catch (error) {
				thrown = error
			}
			expect(thrown).toBeInstanceOf(Error)
			expect(thrown).not.toBeInstanceOf(UsageError)
			expect((thrown as Error).message).toBe(
				'testing api: s has no "openapi" version field; the API tester reads OpenAPI 3.0–3.2 only',
			)
		}
	})
})
