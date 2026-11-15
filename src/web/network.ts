import type { Request, Route } from "@playwright/test"

/*
 * Every request a test's page makes goes to an origin the test knows about: the app's own, or one
 * it allowed (and maybe stubbed). Anything else is aborted and fails the test after it runs, so a
 * forgotten analytics call or a CDN that is down never makes a run slow, flaky or leaky.
 */

type Fulfill = NonNullable<Parameters<Route["fulfill"]>[0]>

export interface AllowOptions {
	/** Answer every request to the origin with this instead of letting it out. */
	fulfill?: Fulfill
}

export interface Network {
	/** Let requests to `origin` (`scheme://host[:port]`) through, or answer them with `fulfill`. */
	allow(origin: string, options?: AllowOptions): void
}

/** The gate a fixture routes every request through, and what it blocked. */
export interface NetworkGate {
	network: Network
	handle(route: Route): Promise<void>
	breaches(): string[]
}

/* No request leaves the browser for these: they read memory or nothing. */
const LOCAL_SCHEMES: ReadonlySet<string> = /* @__PURE__ */ new Set(["about:", "blob:", "data:"])
const CORS = "access-control-allow-origin"

function originOf(text: string): string | null {
	try {
		const { origin } = new URL(text)
		return origin === text ? origin : null
	} catch {
		return null
	}
}

/* A stub the page reads cross-origin needs a CORS header; one the test set, or a full response, stays as given. */
function withCors(fulfill: Fulfill): Fulfill {
	if (fulfill.response !== undefined) return fulfill
	const headers = fulfill.headers ?? {}
	if (Object.keys(headers).some((name) => name.toLowerCase() === CORS)) return fulfill
	return { ...fulfill, headers: { ...headers, [CORS]: "*" } }
}

/* The page path a request came from; a service worker's request has no frame. */
function fromText(request: Request): string {
	try {
		return ` from ${new URL(request.frame().url()).pathname}`
	} catch {
		return ""
	}
}

const isMainNavigation = (request: Request): boolean =>
	request.isNavigationRequest() && request.frame().parentFrame() === null

/** A gate whose first party is `firstParty`'s origin, or with none, each origin the main frame navigates to. */
export function createNetwork({ firstParty }: { firstParty: string | undefined }): NetworkGate {
	const own = new Set(firstParty === undefined ? [] : [new URL(firstParty).origin])
	const allowed = new Map<string, AllowOptions>()
	const blocked: string[] = []
	return {
		breaches: () => [...blocked],
		async handle(route) {
			const request = route.request()
			const url = new URL(request.url())
			if (LOCAL_SCHEMES.has(url.protocol)) return route.continue()
			if (firstParty === undefined && isMainNavigation(request)) own.add(url.origin)
			if (own.has(url.origin)) return route.continue()
			const allow = allowed.get(url.origin)
			if (allow?.fulfill !== undefined) return route.fulfill(withCors(allow.fulfill))
			if (allow !== undefined) return route.continue()
			blocked.push(
				`network: ${request.method()} ${request.url()}${fromText(request)}: origin not declared; call network.allow`,
			)
			return route.abort("blockedbyclient")
		},
		network: {
			allow(origin, options = {}) {
				const parsed = originOf(origin)
				if (parsed === null) {
					throw new Error(`network.allow: ${JSON.stringify(origin)} is not an origin; pass scheme://host[:port]`)
				}
				allowed.set(parsed, options)
			},
		},
	}
}
