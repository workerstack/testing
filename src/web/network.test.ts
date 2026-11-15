import type { APIResponse, Route } from "@playwright/test"
import { describe, expect, it } from "vitest"
import { createNetwork } from "./network.ts"

interface FakeRequest {
	url: string
	method?: string
	navigation?: boolean
	from?: string
	mainFrame?: boolean
}

/* A routed request, and what the gate did with it. */
function route(request: FakeRequest): { route: Route; did: () => Array<[string, unknown]> } {
	const did: Array<[string, unknown]> = []
	const frame = {
		parentFrame: () => (request.mainFrame === false ? {} : null),
		url: () => request.from ?? "http://127.0.0.1:4000/home.html",
	}
	const fake = {
		abort: async (code: string) => void did.push(["abort", code]),
		continue: async () => void did.push(["continue", undefined]),
		fulfill: async (options: unknown) => void did.push(["fulfill", options]),
		request: () => ({
			frame: () => frame,
			isNavigationRequest: () => request.navigation ?? false,
			method: () => request.method ?? "GET",
			url: () => request.url,
		}),
	}
	return { did: () => did, route: fake as unknown as Route }
}

async function through(
	gate: ReturnType<typeof createNetwork>,
	request: FakeRequest,
): Promise<Array<[string, unknown]>> {
	const routed = route(request)
	await gate.handle(routed.route)
	return routed.did()
}

const BASE = "http://127.0.0.1:4000/"

describe("the network gate", () => {
	it("lets the app's own origin through, and data, blob and about URLs", async () => {
		const gate = createNetwork({ firstParty: BASE })
		for (const url of [
			"http://127.0.0.1:4000/app.js",
			"data:text/plain,hi",
			"blob:http://127.0.0.1:4000/1",
			"about:blank",
		])
			expect(await through(gate, { url })).toEqual([["continue", undefined]])
		expect(gate.breaches()).toEqual([])
	})

	it("aborts a request to an undeclared origin and reports it after the test", async () => {
		const gate = createNetwork({ firstParty: BASE })
		const did = await through(gate, {
			from: "http://127.0.0.1:4000/external.html",
			url: "https://cdn.example.invalid/x.js",
		})
		expect(did).toEqual([["abort", "blockedbyclient"]])
		await through(gate, { method: "POST", url: "https://api.example.invalid/track" })
		expect(gate.breaches()).toEqual([
			"network: GET https://cdn.example.invalid/x.js from /external.html: origin not declared; call network.allow",
			"network: POST https://api.example.invalid/track from /home.html: origin not declared; call network.allow",
		])
	})

	it("blocks a navigation to another origin when the app has a base URL", async () => {
		const gate = createNetwork({ firstParty: BASE })
		expect(await through(gate, { navigation: true, url: "https://example.invalid/" })).toEqual([
			["abort", "blockedbyclient"],
		])
	})

	it("without a base URL, makes each main-frame navigation's origin first party, a third party's too", async () => {
		const gate = createNetwork({ firstParty: undefined })
		expect(await through(gate, { url: "https://example.invalid/app.js" })).toEqual([["abort", "blockedbyclient"]])
		expect(await through(gate, { navigation: true, url: "https://example.invalid/" })).toEqual([
			["continue", undefined],
		])
		expect(await through(gate, { url: "https://example.invalid/app.js" })).toEqual([["continue", undefined]])
		expect(await through(gate, { mainFrame: false, navigation: true, url: "https://frame.example.invalid/" })).toEqual([
			["abort", "blockedbyclient"],
		])
	})
})

describe("network.allow", () => {
	it("lets an allowed origin through, or answers it with the stub", async () => {
		const gate = createNetwork({ firstParty: BASE })
		gate.network.allow("https://fonts.example.com")
		gate.network.allow("https://tiles.example.com", { fulfill: { json: { tiles: [] } } })
		expect(await through(gate, { url: "https://fonts.example.com/a.woff2" })).toEqual([["continue", undefined]])
		expect(await through(gate, { url: "https://tiles.example.com/1.json" })).toEqual([
			["fulfill", { headers: { "access-control-allow-origin": "*" }, json: { tiles: [] } }],
		])
		expect(gate.breaches()).toEqual([])
	})

	it("adds the CORS header only where the stub sets none, and leaves a full response alone", async () => {
		const gate = createNetwork({ firstParty: BASE })
		gate.network.allow("https://a.example.com", { fulfill: { body: "x", headers: { "x-id": "1" } } })
		gate.network.allow("https://b.example.com", { fulfill: { headers: { "Access-Control-Allow-Origin": BASE } } })
		const response = {} as APIResponse
		gate.network.allow("https://c.example.com", { fulfill: { response } })
		expect(await through(gate, { url: "https://a.example.com/" })).toEqual([
			["fulfill", { body: "x", headers: { "access-control-allow-origin": "*", "x-id": "1" } }],
		])
		expect(await through(gate, { url: "https://b.example.com/" })).toEqual([
			["fulfill", { headers: { "Access-Control-Allow-Origin": BASE } }],
		])
		expect(await through(gate, { url: "https://c.example.com/" })).toEqual([["fulfill", { response }]])
	})

	it("refuses to allow anything but an origin", () => {
		const { network } = createNetwork({ firstParty: BASE })
		expect(() => network.allow("https://cdn.example.com/x.js")).toThrow(
			'network.allow: "https://cdn.example.com/x.js" is not an origin; pass scheme://host[:port]',
		)
		expect(() => network.allow("cdn.example.com")).toThrow('network.allow: "cdn.example.com" is not an origin')
	})
})

describe("a breach line", () => {
	it("names a request from a frame it cannot read by its URL alone", async () => {
		const gate = createNetwork({ firstParty: BASE })
		const routed = route({ url: "https://cdn.example.invalid/x.js" })
		const request = routed.route.request()
		const blind = {
			...routed.route,
			abort: routed.route.abort,
			request: () => ({
				...request,
				frame: () => {
					throw new Error("Service Worker requests do not have an associated frame.")
				},
			}),
		} as unknown as Route
		await gate.handle(blind)
		expect(gate.breaches()).toEqual([
			"network: GET https://cdn.example.invalid/x.js: origin not declared; call network.allow",
		])
	})
})
