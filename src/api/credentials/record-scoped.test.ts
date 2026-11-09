import { describe, expect, it } from "vitest"
import { createRecordScopes } from "./record-scoped.ts"

/* A record's credential covers what its creator sends at the record's path or below it, for its scheme only. */

describe("createRecordScopes", () => {
	it("names the holder for the record's own path and what is under it, and nobody elsewhere", () => {
		const records = createRecordScopes()
		records.add({ holder: "alpha#record-1", path: "/v1/orgs/o1", principal: "alpha", scheme: "bearer" })
		expect(
			[
				"GET /v1/orgs/o1",
				"POST /v1/orgs/o1/projects",
				"GET /v1/orgs",
				"GET /v1/orgs/o10",
				"GET https://x.test/v1/orgs/o1",
			].map((route) => records.holderFor("alpha", "bearer", route)),
		).toEqual(["alpha#record-1", "alpha#record-1", undefined, undefined, undefined])
	})

	it("covers only its creator's requests, for the scheme the create was sent with", () => {
		const records = createRecordScopes()
		records.add({ holder: "alpha#record-1", path: "/v1/orgs/o1", principal: "alpha", scheme: "bearer" })
		expect([
			records.holderFor("beta", "bearer", "GET /v1/orgs/o1"),
			records.holderFor("alpha", "apiKey", "GET /v1/orgs/o1"),
		]).toEqual([undefined, undefined])
	})

	it("names the innermost record covering the route, whatever order they were added in", () => {
		const records = createRecordScopes()
		records.add({ holder: "alpha#record-2", path: "/v1/orgs/o1/workspaces/w1", principal: "alpha", scheme: "bearer" })
		records.add({ holder: "alpha#record-1", path: "/v1/orgs/o1", principal: "alpha", scheme: "bearer" })
		expect([
			records.holderFor("alpha", "bearer", "DELETE /v1/orgs/o1/workspaces/w1/items/i1"),
			records.holderFor("alpha", "bearer", "DELETE /v1/orgs/o1/workspaces/w2"),
		]).toEqual(["alpha#record-2", "alpha#record-1"])
	})

	it("replaces the credential held for the same record and scheme", () => {
		const records = createRecordScopes()
		records.add({ holder: "alpha#record-1", path: "/v1/orgs/o1", principal: "alpha", scheme: "bearer" })
		records.add({ holder: "alpha#record-2", path: "/v1/orgs/o1", principal: "alpha", scheme: "bearer" })
		expect(records.holderFor("alpha", "bearer", "GET /v1/orgs/o1")).toBe("alpha#record-2")
	})

	it("issues each holder a fresh id", () => {
		const records = createRecordScopes()
		expect([records.nextHolder("alpha"), records.nextHolder("beta")]).toEqual(["alpha#record-1", "beta#record-2"])
	})
})
