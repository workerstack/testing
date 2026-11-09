import { describe, expect, it } from "vitest"
import type { Endpoint, HttpMethod, OperationObject } from "../types.ts"
import {
	isEntityAction,
	readCreatedIdFrom,
	readCredentialFrom,
	readEntity,
	readRecordPath,
	singularize,
} from "./entity.ts"
import { GapCollector } from "./gaps.ts"

const at = (method: HttpMethod, path: string, op: Partial<OperationObject> = {}): Endpoint => ({
	method,
	op: { responses: {}, ...op } as OperationObject,
	operationId: `${method} ${path}`,
	path,
})

describe("isEntityAction", () => {
	it("is each action x-entity may declare, and nothing else", () => {
		for (const action of ["create", "list", "read", "update", "delete", "action"])
			expect(isEntityAction(action)).toBe(true)
		for (const value of ["get", "LIST", "", null, 1]) expect(isEntityAction(value)).toBe(false)
	})
})

describe("singularize", () => {
	it("reads irregular, -es, -ies, non-plural and plain endings", () => {
		expect(singularize("People")).toBe("person")
		expect(singularize("boxes")).toBe("box")
		expect(singularize("branches")).toBe("branch")
		expect(singularize("policies")).toBe("policy")
		expect(singularize("keys")).toBe("key")
		expect(singularize("status")).toBe("status")
		expect(singularize("analysis")).toBe("analysis")
		expect(singularize("notes")).toBe("note")
		expect(singularize("data")).toBe("data")
	})
})

describe("x-entity", () => {
	it("takes the tag when it names an entity and an action", () => {
		expect(readEntity(at("get", "/x", { "x-entity": { action: "list", name: "note" } }))).toEqual({
			action: "list",
			name: "note",
			source: "tag",
		})
		expect(
			readEntity(at("get", "/x/{id}", { "x-entity": { action: "read", identity: "slug", name: "note" } })),
		).toEqual({
			action: "read",
			identity: "slug",
			name: "note",
			source: "tag",
		})
	})

	it("infers from the path when the tag names no action it knows, or no name", () => {
		const inferred = { action: "list", name: "note", source: "heuristic" }
		expect(readEntity(at("get", "/notes", { "x-entity": { action: "browse", name: "memo" } }))).toEqual(inferred)
		expect(readEntity(at("get", "/notes", { "x-entity": { action: "list", name: 7 } }))).toEqual(inferred)
		expect(readEntity(at("get", "/notes", { "x-entity": null }))).toEqual(inferred)
		expect(readEntity(at("get", "/notes", { "x-entity": { action: "list", identity: 7, name: "memo" } }))).toEqual({
			action: "list",
			name: "memo",
			source: "tag",
		})
	})

	it("infers CRUD from the path and method otherwise", () => {
		const action = (method: HttpMethod, path: string) => readEntity(at(method, path))?.action
		expect(action("get", "/v1/notes")).toBe("list")
		expect(action("get", "/v1/notes/{id}")).toBe("read")
		expect(action("post", "/v1/notes")).toBe("create")
		expect(action("post", "/v1/notes/{id}")).toBe("action")
		expect(action("put", "/v1/notes/{id}")).toBe("update")
		expect(action("patch", "/v1/notes/{id}")).toBe("update")
		expect(action("delete", "/v1/notes/{id}")).toBe("delete")
		expect(action("delete", "/v1/notes")).toBe("action")
		/* The last fixed segment names the entity, so a trailing verb reads as one. */
		expect(readEntity(at("post", "/v1/tables/{id}/restore"))).toEqual({
			action: "create",
			name: "restore",
			source: "heuristic",
		})
		expect(readEntity(at("get", "/v1/projects/{p}/tables"))).toEqual({
			action: "list",
			name: "table",
			source: "heuristic",
		})
		expect(readEntity(at("get", "/x", { "x-entity": { name: "note" } }))?.source).toBe("heuristic")
	})
})

describe("x-entity: no entity", () => {
	it("records a gap when the path names no entity", () => {
		const gaps = new GapCollector()
		expect(readEntity(at("get", "/{id}"), gaps)).toBeNull()
		expect(readEntity(at("get", "/v1"), gaps)).toBeNull()
		expect(readEntity(at("head", "/notes/{id}"), gaps)).toBeNull()
		expect(readEntity(at("get", "/"))).toBeNull()
		expect(gaps.gaps.map((gap) => gap.operationId)).toEqual(["get /{id}", "get /v1", "head /notes/{id}"])
		expect(gaps.gaps[0]?.detail).toContain('path "/{id}" does not follow /<plural>/{id}')
	})

	it("reads recordPath and createdIdFrom, non-empty strings only", () => {
		const op = at("get", "/x", { "x-entity": { createdIdFrom: "$.id", recordPath: "$.data" } })
		expect(readRecordPath(op)).toBe("$.data")
		expect(readCreatedIdFrom(op)).toBe("$.id")
		const blank = at("get", "/x", { "x-entity": { createdIdFrom: 1, recordPath: "" } })
		expect(readRecordPath(blank)).toBeNull()
		expect(readCreatedIdFrom(blank)).toBeNull()
		expect(readRecordPath(at("get", "/x"))).toBeNull()
		expect(readCreatedIdFrom(at("get", "/x"))).toBeNull()
	})

	it("reads a create's credentialFrom, and names the gap on any other operation", () => {
		const gaps = new GapCollector()
		const declared = { "x-entity": { credentialFrom: "$.access_token" } }
		expect(readCredentialFrom(at("post", "/orgs", declared), "create", gaps)).toBe("$.access_token")
		expect(readCredentialFrom(at("get", "/orgs/{id}", declared), "read", gaps)).toBeNull()
		expect(readCredentialFrom(at("post", "/", declared), null, gaps)).toBeNull()
		expect(readCredentialFrom(at("post", "/orgs", { "x-entity": { credentialFrom: "" } }), "create", gaps)).toBeNull()
		expect(readCredentialFrom(at("post", "/orgs"), "create")).toBeNull()
		expect(gaps.gaps.map((gap) => [gap.operationId, gap.tag, gap.detail])).toEqual([
			[
				"get /orgs/{id}",
				"x-entity",
				"x-entity.credentialFrom applies to a create, and this operation is read; it is ignored",
			],
			[
				"post /",
				"x-entity",
				"x-entity.credentialFrom applies to a create, and this operation is no entity action; it is ignored",
			],
		])
	})
})
