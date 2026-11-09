import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import type { AddressInfo } from "node:net"
import { afterEach, describe, expect, it } from "vitest"
import type { SecurityConfig } from "../../../src/api/config/types/security.ts"
import type { Exchange } from "../../../src/api/runtime/exchange.ts"
import { run } from "../../../src/api/runtime/run/index.ts"
import type { OpenApiDocument } from "../../../src/api/spec/types.ts"

/*
 * An API that gives each account one token scoped to one tenant. Creating a tenant answers with a
 * token for it; the creator's own token is refused under the tenant, and the tenant's anywhere else.
 * A create declaring `x-entity.credentialFrom` hands that token to its creator for the record it made.
 */

const closers: Array<() => Promise<void>> = []

afterEach(async () => {
	await Promise.all(closers.splice(0).map((close) => close()))
})

const json = (schema: unknown) => ({ "application/json": { schema } })
const idParam = (name: string) => ({ in: "path", name, required: true, schema: { type: "string" } })
const named = {
	properties: { id: { type: "string" }, name: { type: "string" } },
	required: ["id", "name"],
	type: "object",
}
const issuedOrg = {
	properties: { ...named.properties, access_token: { type: "string" }, refresh_token: { type: "string" } },
	required: ["id", "name", "access_token"],
	type: "object",
}
const listOf = (schema: unknown) => json({ properties: { items: { items: schema, type: "array" } }, type: "object" })
const nameBody = {
	content: json({ properties: { name: { maxLength: 40, type: "string" } }, required: ["name"], type: "object" }),
	required: true,
}
const refused = { "401": { description: "no credential" }, "403": { description: "another tenant's token" } }

/* The projects under an org, whose every request needs that org's token. */
const PROJECT_PATHS = {
	"/v1/organizations/{org_id}/projects": {
		get: {
			operationId: "project.list",
			parameters: [idParam("org_id")],
			responses: { "200": { content: listOf(named), description: "ok" }, ...refused },
		},
		post: {
			operationId: "project.create",
			parameters: [idParam("org_id")],
			requestBody: nameBody,
			responses: { "201": { content: json(named), description: "made" }, ...refused },
		},
	},
	"/v1/organizations/{org_id}/projects/{project_id}": {
		delete: {
			operationId: "project.delete",
			parameters: [idParam("org_id"), idParam("project_id")],
			responses: { "204": { description: "gone" }, ...refused },
		},
		get: {
			operationId: "project.get",
			parameters: [idParam("org_id"), idParam("project_id")],
			responses: {
				"200": { content: json(named), description: "ok" },
				"404": { description: "missing" },
				...refused,
			},
		},
	},
}

/* The org create, with or without the declaration under test. */
function spec(declared: boolean): OpenApiDocument {
	const orgEntity = {
		action: "create",
		name: "organization",
		...(declared ? { credentialFrom: "$.access_token" } : {}),
	}
	return {
		components: { securitySchemes: { bearer: { scheme: "bearer", type: "http" } } },
		info: { title: "tenants", version: "1" },
		openapi: "3.1.0",
		paths: {
			"/v1/organizations": {
				get: {
					operationId: "org.list",
					responses: { "200": { content: listOf(named), description: "ok" }, ...refused },
				},
				post: {
					operationId: "org.create",
					requestBody: nameBody,
					responses: { "201": { content: json(issuedOrg), description: "made" }, ...refused },
					"x-entity": orgEntity,
				},
			},
			"/v1/organizations/{org_id}": {
				delete: {
					operationId: "org.delete",
					parameters: [idParam("org_id")],
					responses: { "204": { description: "gone" }, ...refused },
				},
				get: {
					operationId: "org.get",
					parameters: [idParam("org_id")],
					responses: {
						"200": { content: json(named), description: "ok" },
						"404": { description: "missing" },
						...refused,
					},
				},
			},
			...PROJECT_PATHS,
		},
		security: [{ bearer: [] }],
	} as unknown as OpenApiDocument
}

/* The platform admin signs in by its user; a refresh exchanges a refresh token for a new access token. */
const security: SecurityConfig = {
	bearer: {
		login: {
			from: "$.access_token",
			steps: [
				{
					body: { user: "admin" },
					method: "POST",
					path: "/v1/auth/login",
					saveAs: { refresh_token: "$.refresh_token" },
				},
			],
		},
		refresh: {
			from: "$.access_token",
			steps: [{ body: { token: "{refresh_token}" }, method: "POST", path: "/v1/auth/refresh" }],
		},
	},
}

type Send = (status: number, value?: unknown) => void
type Row = { id: string; name: string }

interface World {
	orgs: Map<string, { name: string; projects: Map<string, Row> }>
	/* Each live token, and the org it is scoped to: `null` for the admin's own. */
	tokens: Map<string, string | null>
	/* Each org's refresh token, and the generation the next refresh issues. */
	refreshes: Map<string, { org: string; next: number }>
	/* Whether an org's first token has lapsed by its first use. */
	expiring: boolean
	made: number
}

/* Who may act where: `null` for the collection of tenants, else the org a path is under. */
function authorize(world: World, req: IncomingMessage, scope: string | null): number | null {
	const token = /^Bearer (.+)$/.exec(req.headers.authorization ?? "")?.[1]
	if (token === undefined || !world.tokens.has(token)) return 401
	return world.tokens.get(token) === scope ? null : 403
}

function createOrg(world: World, raw: string, send: Send): void {
	world.made += 1
	const id = `org_${world.made}`
	const name = String((JSON.parse(raw || "{}") as { name?: unknown }).name ?? "")
	world.orgs.set(id, { name, projects: new Map() })
	const first = `tok-${id}-1`
	/* A lapsed token is one the server no longer accepts. */
	if (!world.expiring) world.tokens.set(first, id)
	world.refreshes.set(`r-${id}`, { next: 2, org: id })
	send(201, { access_token: first, id, name, refresh_token: `r-${id}` })
}

/* What a handler is given beside the world: the request's path and raw body, and how to answer. */
interface Call {
	path: string
	raw: string
	send: Send
}

function auth(world: World, { path, raw, send }: Call): void {
	const body = JSON.parse(raw || "{}") as { token?: string; user?: string }
	if (path === "/v1/auth/login") {
		world.tokens.set("admin", null)
		return send(200, { access_token: "admin", refresh_token: "r-admin" })
	}
	if (body.token === "r-admin") return send(200, { access_token: "admin" })
	const refresh = world.refreshes.get(body.token ?? "")
	if (refresh === undefined) return send(401, { error: "invalid_refresh" })
	const token = `tok-${refresh.org}-${refresh.next}`
	refresh.next += 1
	world.tokens.set(token, refresh.org)
	send(200, { access_token: token })
}

function projects(world: World, at: { org: string; project?: string; method?: string }, { raw, send }: Call): void {
	const rows = world.orgs.get(at.org)?.projects
	if (rows === undefined) return send(404, { error: "not_found" })
	if (at.project === undefined && at.method === "POST") {
		world.made += 1
		const row = { id: `prj_${world.made}`, name: String((JSON.parse(raw || "{}") as { name?: unknown }).name ?? "") }
		rows.set(row.id, row)
		return send(201, row)
	}
	if (at.project === undefined) return send(200, { items: [...rows.values()] })
	const row = rows.get(at.project)
	if (row === undefined) return send(404, { error: "not_found" })
	if (at.method === "DELETE") {
		rows.delete(at.project)
		return send(204)
	}
	send(200, row)
}

function orgItem(world: World, at: { org: string; method?: string }, send: Send): void {
	const found = world.orgs.get(at.org)
	if (found === undefined) return send(404, { error: "not_found" })
	if (at.method === "DELETE") {
		world.orgs.delete(at.org)
		return send(204)
	}
	send(200, { id: at.org, name: found.name })
}

function route(world: World, req: IncomingMessage, call: Call): void {
	const { path, raw, send } = call
	const method = req.method ?? "GET"
	if (path.startsWith("/v1/auth/")) return auth(world, call)
	const under = /^\/v1\/organizations\/([^/]+)(?:\/projects(?:\/([^/]+))?)?$/.exec(path)
	const denied = authorize(world, req, under === null ? null : (under[1] as string))
	if (denied !== null) return send(denied, { error: denied === 403 ? "token_context_mismatch" : "unauthorized" })
	if (path === "/v1/organizations") {
		if (method === "POST") return createOrg(world, raw, send)
		return send(200, { items: [...world.orgs].map(([id, { name }]) => ({ id, name })) })
	}
	if (under === null) return send(404, { error: "not_found" })
	const scoped = { method, org: under[1] as string }
	if (!path.includes("/projects")) return orgItem(world, scoped, send)
	projects(world, { ...scoped, ...(under[2] === undefined ? {} : { project: under[2] }) }, call)
}

async function serve(options: { declared: boolean; expiring?: boolean }): Promise<{ url: string; world: World }> {
	const world: World = {
		expiring: options.expiring === true,
		made: 0,
		orgs: new Map(),
		refreshes: new Map(),
		tokens: new Map(),
	}
	const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
		const url = new URL(req.url ?? "/", "http://127.0.0.1")
		let raw = ""
		for await (const chunk of req) raw += chunk
		const send: Send = (status, value) => {
			res.writeHead(status, value === undefined ? {} : { "content-type": "application/json" })
			res.end(value === undefined ? undefined : JSON.stringify(value))
		}
		if (url.pathname === "/openapi.json") return send(200, spec(options.declared))
		route(world, req, { path: url.pathname, raw, send })
	})
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
	closers.push(() => new Promise((resolve) => server.close(() => resolve())))
	return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, world }
}

const pathOf = (exchange: Exchange): string => new URL(exchange.url).pathname
const bearerOf = (exchange: Exchange): string | undefined => exchange.requestHeaders["Authorization"]
const ORG_ITEM = /^\/v1\/organizations\/org_\d+$/
const PROJECTS = /^\/v1\/organizations\/org_\d+\/projects$/

function runAgainst(url: string) {
	return run({
		baseUrl: url,
		principals: { admin: {} },
		security,
		seed: 1,
		spec: `${url}/openapi.json`,
	})
}

/* Under each org the admin made, its own token, never refused; the admin's token on the collection. */
function expectScoped(sent: readonly Exchange[]): void {
	const childCreates = sent.filter((exchange) => exchange.method === "POST" && PROJECTS.test(pathOf(exchange)))
	const orgDeletes = sent.filter((exchange) => exchange.method === "DELETE" && ORG_ITEM.test(pathOf(exchange)))
	const collection = sent.filter((exchange) => pathOf(exchange) === "/v1/organizations")
	const orgOf = (exchange: Exchange): string | undefined => /org_\d+/.exec(pathOf(exchange))?.[0]
	expect(childCreates).not.toHaveLength(0)
	for (const create of childCreates)
		expect([bearerOf(create), create.status]).toEqual([`Bearer tok-${orgOf(create)}-1`, 201])
	/* Each org's delete carries its own token; a second delete of one a check removed answers 404. */
	expect(orgDeletes.filter((exchange) => exchange.status === 204)).not.toHaveLength(0)
	for (const remove of orgDeletes) expect(bearerOf(remove)).toBe(`Bearer tok-${orgOf(remove)}-1`)
	expect(new Set(collection.map(bearerOf))).toEqual(new Set(["Bearer admin"]))
	/* Nothing the admin sent under an org it made was refused for carrying the wrong tenant's token. */
	const underOrgs = sent.filter((exchange) => orgOf(exchange) !== undefined)
	expect(underOrgs.filter((exchange) => exchange.status === 403).map(pathOf)).toEqual([])
}

describe("a create that hands its creator a credential for what it made", () => {
	it("sends it under the record, the creator's own elsewhere, and tears everything down", async () => {
		const { url, world } = await serve({ declared: true })
		const result = await runAgainst(url)
		expectScoped(
			result.client.transcript.filter((exchange) => exchange.principal === "admin" && exchange.probe !== true),
		)
		expect(result.teardown?.failed ?? []).toEqual([])
		expect(world.orgs.size).toBe(0)
		/* The exchange names the creator, never the principal the record's credential is held under. */
		expect(result.client.transcript.some((exchange) => exchange.principal?.includes("#record-") === true)).toBe(false)
	})

	it("renews a lapsed one from the refresh token its create answered with, never the creator's own", async () => {
		const { url, world } = await serve({ declared: true, expiring: true })
		const result = await runAgainst(url)
		const { transcript } = result.client
		const refreshes = transcript
			.filter((exchange) => pathOf(exchange) === "/v1/auth/refresh")
			.map((exchange) => (exchange.requestBody as { token?: string }).token)
		const childCreates = transcript.filter(
			(exchange) => exchange.method === "POST" && PROJECTS.test(pathOf(exchange)) && exchange.status === 201,
		)

		expect(refreshes).toContain("r-org_1")
		expect(refreshes).not.toContain("r-admin")
		expect(childCreates).not.toHaveLength(0)
		for (const create of childCreates)
			expect(bearerOf(create)).toBe(`Bearer tok-${/org_\d+/.exec(pathOf(create))?.[0]}-2`)
		expect(result.teardown?.failed ?? []).toEqual([])
		expect(world.orgs.size).toBe(0)
	})

	it("leaves an undeclared create as it was: the creator's own token is refused under the record", async () => {
		const { url, world } = await serve({ declared: false })
		const result = await runAgainst(url)
		const childCreates = result.client.transcript.filter(
			(exchange) => exchange.method === "POST" && PROJECTS.test(pathOf(exchange)),
		)

		expect(childCreates.length).toBeGreaterThan(0)
		expect(childCreates.every((exchange) => bearerOf(exchange) === "Bearer admin" && exchange.status === 403)).toBe(
			true,
		)
		expect(world.orgs.size).toBeGreaterThan(0)
	})
})
