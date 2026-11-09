import { describe, expect, it } from "vitest"
import { harness } from "../credentials/__fixtures__/store.ts"
import { createRecordScopes } from "../credentials/record-scoped.ts"
import type { Credential } from "../credentials/store.ts"
import { buildModel } from "../spec/graph/build.ts"
import type { OpenApiDocument } from "../spec/types.ts"
import type { Exchange } from "./exchange.ts"
import { createRecordAdopter } from "./record-credential.ts"

/*
 * A create that declares `x-entity.credentialFrom` hands its creator a credential for the record it
 * made: held in the store under a principal of its own, and named for the record's path, so only
 * what the creator sends there or below it carries it.
 */

const json = (schema: unknown) => ({ content: { "application/json": { schema } } })
const ROW = { properties: { id: { type: "string" }, name: { type: "string" } }, type: "object" }
const param = (name: string) => ({ in: "path", name, required: true, schema: { type: "string" } })
const create = (operationId: string, more: Record<string, unknown> = {}) => ({
	operationId,
	requestBody: { ...json(ROW), required: true },
	responses: { "201": { ...json(ROW), description: "made" } },
	...more,
})
const read = (operationId: string, params: string[]) => ({
	operationId,
	parameters: params.map(param),
	responses: { "200": { ...json(ROW), description: "ok" } },
})
const adopts = (name: string) => ({ "x-entity": { action: "create", credentialFrom: "$.access_token", name } })

const DOCUMENT = {
	info: { title: "tenants", version: "1" },
	openapi: "3.1.0",
	paths: {
		"/orgs": { post: create("org.create", adopts("org")) },
		"/orgs/{org_id}": { get: read("org.get", ["org_id"]) },
		"/orgs/{org_id}/projects": {
			post: create("project.create", { parameters: [param("org_id")], ...adopts("project") }),
		},
		"/orgs/{org_id}/projects/{project_id}": { get: read("project.get", ["org_id", "project_id"]) },
		"/spaces/": { post: create("space.create", adopts("space")) },
		"/teams": { post: create("team.create", adopts("team")) },
		"/regions/{region}/teams/{team_id}": { get: read("team.get", ["region", "team_id"]) },
		"/notes": { post: create("note.create") },
	},
} as unknown as OpenApiDocument

const BASE = "http://api.test"
const relativePath = (url: string): string => new URL(url).pathname

function adopterOf(mapping?: Record<string, string>) {
	const { store } = harness()
	const records = createRecordScopes()
	const model = buildModel(DOCUMENT)
	const adopter = createRecordAdopter({
		model,
		records,
		relativePath,
		store,
		mapping,
	})
	return { adopter, records, store }
}

/* A create cy sent with its jwt, answered 201 with a token for what it made, less any field `drop` names. */
function answered(over: Partial<Exchange> = {}, drop?: keyof Exchange): Exchange {
	const exchange = {
		method: "POST",
		operationId: "org.create",
		pathParams: {},
		principal: "cy",
		requestBody: { name: "acme" },
		responseBody: { access_token: "org-token", id: "o1", name: "acme", refresh_token: "r-o1" },
		responseHeaders: {},
		schemes: ["jwt"],
		status: 201,
		url: `${BASE}/orgs`,
		...over,
	} as Record<string, unknown>
	if (drop !== undefined) delete exchange[drop]
	return exchange as unknown as Exchange
}

describe("createRecordAdopter: a create that declares a credential", () => {
	it("holds it for the creator under the record's item route, the creator's own left as it was", async () => {
		const { adopter, records, store } = adopterOf()
		await adopter.observe(answered())
		const holder = records.holderFor("cy", "jwt", "GET /orgs/o1")
		const held = (await store.acquire({ principal: holder as string, scheme: "jwt" })) as Credential
		const own = (await store.acquire({ principal: "cy", scheme: "jwt" })) as Credential
		expect([holder, held.value, own.value]).toEqual(["cy#record-1", "org-token", "cy-1"])
		expect(records.holderFor("cy", "jwt", "GET /orgs")).toBeUndefined()
		expect(store.principals["cy#record-1"]).toEqual(store.principals["cy"])
	})

	it("holds a child's under its own route, inside its parent's", async () => {
		const { adopter, records } = adopterOf()
		await adopter.observe(answered())
		await adopter.observe(
			answered({
				operationId: "project.create",
				pathParams: { org_id: "o1" },
				responseBody: { access_token: "project-token", id: "p1" },
				url: `${BASE}/orgs/o1/projects`,
			}),
		)
		expect(records.holderFor("cy", "jwt", "DELETE /orgs/o1/projects/p1")).toBe("cy#record-2")
		expect(records.holderFor("cy", "jwt", "POST /orgs/o1/projects")).toBe("cy#record-1")
	})

	it("names the record below the create's path when the entity has no item route, or one the create cannot fill", async () => {
		const { adopter, records } = adopterOf()
		await adopter.observe(
			answered({ operationId: "space.create", responseBody: { access_token: "s", id: "s 1" }, url: `${BASE}/spaces/` }),
		)
		await adopter.observe(
			answered({ operationId: "team.create", responseBody: { access_token: "t", id: "t1" }, url: `${BASE}/teams` }),
		)
		expect(records.holderFor("cy", "jwt", "GET /spaces/s%201/members")).toBe("cy#record-1")
		expect(records.holderFor("cy", "jwt", "GET /teams/t1")).toBe("cy#record-2")
	})
})

describe("createRecordAdopter: a secondary origin's run", () => {
	it("holds it under the primary scheme the origin's maps to, and nothing for a scheme with no mapping", async () => {
		const mapped = adopterOf({ originJwt: "jwt" })
		await mapped.adopter.observe(answered({ schemes: ["originJwt"] }))
		await mapped.adopter.observe(answered({ responseBody: { access_token: "t", id: "o2" }, schemes: ["other"] }))
		expect([
			mapped.records.holderFor("cy", "jwt", "GET /orgs/o1"),
			mapped.records.holderFor("cy", "jwt", "GET /orgs/o2"),
			mapped.records.holderFor("cy", "other", "GET /orgs/o2"),
		]).toEqual(["cy#record-1", undefined, undefined])
	})
})

describe("createRecordAdopter: what adopts nothing", () => {
	const cases: Array<[string, Partial<Exchange>, (keyof Exchange)?]> = [
		["a refused create", { status: 403 }],
		["a probe", { probe: true }],
		["a forged credential", { forged: true }],
		["a create that declares no credential", { operationId: "note.create", url: `${BASE}/notes` }],
		["an answer with no operation", {}, "operationId"],
		["an answer whose credential is not a string", { responseBody: { access_token: 7, id: "o1" } }],
		["an answer whose credential is empty", { responseBody: { access_token: "", id: "o1" } }],
		["a create no principal sent", {}, "principal"],
		["a create that carried no credential", { schemes: [] }],
		["a principal the store does not know", { principal: "ghost" }],
		["an answer with no id", { responseBody: { access_token: "org-token" } }],
		["a scheme the store cannot hold it under", { schemes: ["digest"] }],
	]
	for (const [name, over, drop] of cases) {
		it(`ignores ${name}`, async () => {
			const { adopter, records } = adopterOf()
			await adopter.observe(answered(over, drop))
			expect(records.holderFor(over.principal ?? "cy", over.schemes?.[0] ?? "jwt", "GET /orgs/o1")).toBeUndefined()
		})
	}
})
