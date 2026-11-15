import type { ConsoleMessage, Page, TestInfo } from "@playwright/test"
import { describe, expect, it } from "vitest"
import type { GuardOptions } from "./guard.ts"
import { fixtures, guardPage } from "./fixtures.ts"

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
})
