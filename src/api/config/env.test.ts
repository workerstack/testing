import { describe, expect, it } from "vitest"
import { DEFER_ENV, env, MissingEnvError } from "./env.ts"

describe("env", () => {
	it("reads a set variable", () => {
		expect(env("TOKEN", { TOKEN: "t" })).toBe("t")
	})

	it("refuses an unset or empty one, naming it, rather than sending an empty credential", () => {
		expect(() => env("TOKEN", {})).toThrow(new MissingEnvError("TOKEN"))
		expect(() => env("TOKEN", { TOKEN: "" })).toThrow("testing api: env TOKEN is not set")
	})

	it("reads the process environment by default", () => {
		process.env["TESTING_API_ENV_TEST_SET"] = "yes"
		try {
			expect(env("TESTING_API_ENV_TEST_SET")).toBe("yes")
		} finally {
			delete process.env["TESTING_API_ENV_TEST_SET"]
		}
	})

	it("defers an unset variable to its ${NAME} literal only when TESTING_API_DEFER_ENV is exactly 1", () => {
		expect(env("TESTING_API_TOKEN", { [DEFER_ENV]: "1" })).toBe("${TESTING_API_TOKEN}")
		expect(env("TESTING_API_TOKEN", { [DEFER_ENV]: "1", TESTING_API_TOKEN: "t" })).toBe("t")
		for (const near of ["true", "yes", "0", "", " 1"]) {
			expect(() => env("TESTING_API_TOKEN", { [DEFER_ENV]: near })).toThrow(new MissingEnvError("TESTING_API_TOKEN"))
		}
	})
})
