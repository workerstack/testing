import type {
	Fixtures,
	Page,
	PlaywrightTestArgs,
	PlaywrightTestOptions,
	PlaywrightWorkerArgs,
	PlaywrightWorkerOptions,
	TestInfo,
} from "@playwright/test"
import { relative } from "node:path"
import { breaches, breachLine, checkGuard, type GuardOptions, type PageEvent } from "./guard.ts"
import { createReady, type Ready } from "./ready.ts"

/*
 * The fixtures `test` adds to Playwright's: the page a test drives is guarded, and the readiness
 * helpers act on that page. A consumer sets `guard` with `test.use` per file or per describe.
 */

export interface WebFixtures {
	/** What the page may say without failing the test. */
	guard: GuardOptions
	/** Waits on the page's own markers and animations instead of the clock. */
	ready: Ready
}

type TestArgs = PlaywrightTestArgs & PlaywrightTestOptions
type WorkerArgs = PlaywrightWorkerArgs & PlaywrightWorkerOptions

const pathOf = (url: string): string => new URL(url).pathname

/**
 * Hands the test its page and records what the page says. After the test, every breach fails it
 * in one error, one line each; a reasonless ignore fails it before it runs.
 */
export async function guardPage(
	{ guard, page }: { guard: GuardOptions; page: Page },
	use: (page: Page) => Promise<void>,
	testInfo: TestInfo,
): Promise<void> {
	const options = checkGuard(guard)
	const events: PageEvent[] = []
	page.on("console", (message) => events.push({ kind: message.type(), path: pathOf(page.url()), text: message.text() }))
	page.on("pageerror", (error) => events.push({ kind: "pageerror", path: pathOf(page.url()), text: error.message }))
	await use(page)
	const where = `${relative(testInfo.project.testDir, testInfo.file)}:${testInfo.line}`
	const lines = breaches(events, options).map((event) => breachLine(event, where))
	if (lines.length > 0) throw new Error(lines.join("\n"))
}

export const fixtures: Fixtures<WebFixtures, object, TestArgs, WorkerArgs> = {
	guard: [{}, { option: true }],
	page: guardPage,
	ready: async ({ page }, use) => use(createReady(page)),
}
