import { describe, expect, it } from "vitest"
import { defineConfig } from "./define-config.ts"
import type { ApiConfig } from "./types.ts"

describe("defineConfig", () => {
	it("returns the config it is given, unchanged", () => {
		const config: ApiConfig = { baseUrl: "http://h.test", principals: { alpha: {} }, spec: "openapi.json" }
		expect(defineConfig(config)).toBe(config)
	})
})
