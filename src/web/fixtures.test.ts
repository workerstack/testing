import { AxeBuilder } from "@axe-core/playwright"
import type { BrowserContext, ConsoleMessage, Page, Route, TestInfo } from "@playwright/test"
import { describe, expect, it } from "vitest"
import type { GuardOptions } from "./guard.ts"
import { buildAxe, fixtures, guardNetwork, guardPage } from "./fixtures.ts"
import type { Network } from "./network.ts"

type Handler = (payload: unknown) => void

/* A page that emits what a test makes it say, from whatever URL it is on at the time. */
function fakePage(): { page: Page; say: (event: string, payload: unknown) => void; at: (url: string) => void } {
	const handlers = new Map<string, Handler[]>()
	let url = "about:blank"
	const page = {
		on: (event: string, handler: Handler) => handlers.set(event, [...(handlers.get(event) ?? []), handler]),
		url: () => url,
	}
	return {
		at: (next) => {
			url = next
		},
		page: page as unknown as Page,
		say: (event, payload) => {
			for (const handler of handlers.get(event) ?? []) handler(payload)
		},
	}
}

const message = (type: string, text: string): ConsoleMessage =>
	({ text: () => text, type: () => type }) as unknown as ConsoleMessage

const TEST_INFO = { file: "/app/e2e/home/guard.spec.ts", line: 7, project: { testDir: "/app/e2e" } } as TestInfo

async function run(guard: GuardOptions, during: (fake: ReturnType<typeof fakePage>) => void): Promise<Page[]> {
	const fake = fakePage()
	const used: Page[] = []
	await guardPage(
		{ guard, page: fake.page },
		async (page) => {
			used.push(page)
			during(fake)
		},
		TEST_INFO,
	)
	return used
}

describe("guardPage", () => {
	it("hands the test its page and passes when the page said nothing wrong", async () => {
		const used = await run({}, (fake) => fake.say("console", message("log", "ready")))
		expect(used).toHaveLength(1)
	})

	it("fails after the test with one line per breach, naming page, text and test", async () => {
		const failing = run({}, (fake) => {
			fake.at("http://127.0.0.1:4000/console-error.html?x=1")
			fake.say("console", message("error", "boom"))
			fake.at("http://127.0.0.1:4000/page-error.html")
			fake.say("pageerror", new Error("x is not defined"))
		})
		await expect(failing).rejects.toThrow(
			[
				'guard: console.error at /console-error.html: "boom" (home/guard.spec.ts:7)',
				'guard: pageerror at /page-error.html: "x is not defined" (home/guard.spec.ts:7)',
			].join("\n"),
		)
	})

	it("lets through what the test ignores with a reason", async () => {
		const ignore = [{ text: "boom", reason: "logged on purpose" }]
		await expect(run({ ignore }, (fake) => fake.say("console", message("error", "boom")))).resolves.toHaveLength(1)
	})

	it("leaves a request the network gate blocked to the gate's own line", async () => {
		const blocked = "Failed to load resource: net::ERR_BLOCKED_BY_CLIENT.Inspector"
		await expect(run({}, (fake) => fake.say("console", message("error", blocked)))).resolves.toHaveLength(1)
		await expect(run({}, (fake) => fake.say("pageerror", new Error(blocked)))).rejects.toThrow("guard: pageerror")
	})

	it("refuses a reasonless ignore before the test runs", async () => {
		const ignore = [{ text: "boom", reason: "" }]
		await expect(run({ ignore }, () => {})).rejects.toThrow('guard: ignore "boom" has no reason')
	})
})

describe("fixtures", () => {
	it("makes guard an option that defaults to failing on errors only", () => {
		expect(fixtures.guard).toEqual([{}, { option: true }])
	})

	it("guards the page and gives each test the readiness helpers for it", async () => {
		expect(fixtures.page).toBe(guardPage)
		const { page } = fakePage()
		const ready = fixtures.ready as (args: { page: Page }, use: (value: unknown) => Promise<void>) => Promise<void>
		let given: unknown
		await ready({ page }, async (value) => {
			given = value
		})
		expect(Object.keys(given as object)).toEqual(["goto", "settle"])
	})

	it("gives each test a mouse pointer on its page", async () => {
		const { page } = fakePage()
		const pointer = fixtures.pointer as (args: { page: Page }, use: (value: unknown) => Promise<void>) => Promise<void>
		let given: unknown
		await pointer({ page }, async (value) => {
			given = value
		})
		expect(Object.keys(given as object)).toEqual(["drag", "dragCenterTo"])
	})
})

type RouteHandler = (route: Route) => Promise<void>

/* A context that routes as Playwright's does, and a request to `url` the test can send through it. */
function fakeContext(): { context: BrowserContext; send: (url: string) => Promise<string> } {
	const handlers: RouteHandler[] = []
	const context = {
		route: async (pattern: string, handler: RouteHandler) => {
			expect(pattern).toBe("**/*")
			handlers.push(handler)
		},
	}
	const send = async (url: string): Promise<string> => {
		let outcome = "none"
		const route = {
			abort: async () => {
				outcome = "aborted"
			},
			continue: async () => {
				outcome = "continued"
			},
			request: () => ({
				frame: () => ({ parentFrame: () => null, url: () => "http://127.0.0.1:4000/home.html" }),
				isNavigationRequest: () => false,
				method: () => "GET",
				url: () => url,
			}),
		} as unknown as Route
		for (const handler of handlers) await handler(route)
		return outcome
	}
	return { context: context as unknown as BrowserContext, send }
}

describe("guardNetwork", () => {
	it("routes the context before the test, and passes when every request was declared", async () => {
		const { context, send } = fakeContext()
		const seen: string[] = []
		await guardNetwork({ baseURL: "http://127.0.0.1:4000", context }, async (network: Network) => {
			network.allow("https://fonts.example.com")
			seen.push(await send("http://127.0.0.1:4000/app.js"), await send("https://fonts.example.com/a.woff2"))
		})
		expect(seen).toEqual(["continued", "continued"])
	})

	it("aborts an undeclared request and fails the test after it, with the line", async () => {
		const { context, send } = fakeContext()
		const seen: string[] = []
		const gated = guardNetwork({ baseURL: "http://127.0.0.1:4000", context }, async () => {
			seen.push(await send("https://cdn.example.invalid/x.js"))
		})
		await expect(gated).rejects.toThrow(
			"network: GET https://cdn.example.invalid/x.js from /home.html: origin not declared; call network.allow",
		)
		expect(seen).toEqual(["aborted"])
	})

	it("is an auto fixture, so a test that never names it is still gated", () => {
		expect(fixtures.network).toEqual([guardNetwork, { auto: true }])
	})
})

describe("the a11y fixture", () => {
	it("builds a real axe scan for the page", async () => {
		expect(await buildAxe({} as Page)).toBeInstanceOf(AxeBuilder)
	})

	it("scans with the file's a11yDefaults before each call's options", async () => {
		expect(fixtures.a11yDefaults).toEqual([{}, { option: true }])
		const a11y = fixtures.a11y as (
			args: { page: Page; a11yDefaults: object },
			use: (value: { check: () => Promise<void> }) => Promise<void>,
		) => Promise<void>
		const defaults = { exclude: [{ reason: "", selector: "[data-focus-guard]" }] }
		let check: Promise<void> | undefined
		await a11y({ a11yDefaults: defaults, page: {} as Page }, async (value) => {
			check = value.check()
		})
		await expect(check).rejects.toThrow('a11y: exclude "[data-focus-guard]" has no reason')
	})
})
