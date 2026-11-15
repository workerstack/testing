import { expect, test } from "@playwright/test"
import { spawnSync } from "node:child_process"
import { join } from "node:path"

/*
 * The package as a consumer meets it: a Playwright project under tests/web/consumer imports
 * `@workerstack/testing/web` by name (the build `test:web` makes first) and runs against the
 * fixture pages. Each spec there either passes, or fails with the line a user would read.
 */

const ROOT = join(import.meta.dirname, "..", "..", "..")
const CHILD_TIMEOUT_MS = 120_000

interface Outcome {
	status: string
	message: string
}

interface Suite {
	suites?: Suite[]
	specs?: Array<{
		title: string
		tests: Array<{ results: Array<{ status: string; errors: Array<{ message?: string }> }> }>
	}>
}

/* Every spec title in the JSON report, with its one result's status and error text. */
function outcomes(suite: Suite): Array<[string, Outcome]> {
	const own = (suite.specs ?? []).map((spec): [string, Outcome] => {
		const result = spec.tests[0]?.results[0]
		const message = (result?.errors ?? []).map((error) => error.message ?? "").join("\n")
		return [spec.title, { message, status: result?.status ?? "missing" }]
	})
	return [...own, ...(suite.suites ?? []).flatMap(outcomes)]
}

/* The child is its own Playwright run: none of this run's worker variables leak into it. */
function childEnv(): NodeJS.ProcessEnv {
	return Object.fromEntries(
		Object.entries(process.env).filter(([name]) => !/^(PW_|PLAYWRIGHT_|TEST_)/.test(name)),
	) as NodeJS.ProcessEnv
}

test("a consumer project fails exactly the specs whose page went wrong, with the line a user reads", async () => {
	test.setTimeout(CHILD_TIMEOUT_MS)
	const child = spawnSync(
		join(ROOT, "node_modules", ".bin", "playwright"),
		["test", "-c", "tests/web/consumer/playwright.config.ts", "--reporter=json"],
		{ cwd: ROOT, encoding: "utf8", env: { ...childEnv(), FORCE_COLOR: "0" }, timeout: CHILD_TIMEOUT_MS },
	)
	expect(child.stdout, child.stderr).not.toBe("")
	const report = JSON.parse(child.stdout) as { suites: Suite[] }
	const found = new Map(report.suites.flatMap(outcomes))
	const status = Object.fromEntries([...found].map(([title, outcome]) => [title, outcome.status]))
	expect(status).toEqual({
		"a clean page passes": "passed",
		"a console error fails the test": "failed",
		"a page error fails the test": "failed",
		"noise passes when an ignore says why": "passed",
		"an ignore with a blank reason fails before the test runs": "failed",
		"a marker that never shows fails with the page and the marker": "failed",
		"goto waits for the marker, so the first click lands": "passed",
		"settle returns once finite animations end, past an infinite and a canceled one": "passed",
	})
	const message = (title: string): string => found.get(title)?.message ?? ""
	expect(message("a console error fails the test")).toContain(
		'guard: console.error at /console-error.html: "boom" (guard.spec.ts:',
	)
	expect(message("a page error fails the test")).toMatch(
		/guard: pageerror at \/page-error\.html: "notDefined is not defined" \(guard\.spec\.ts:\d+\)/,
	)
	expect(message("an ignore with a blank reason fails before the test runs")).toContain(
		"guard: ignore /ResizeObserver loop/ has no reason; say why the app may log it",
	)
	expect(message("a marker that never shows fails with the page and the marker")).toContain(
		"ready.goto: /index.html never showed html[data-hydrated] (timeout 500ms)",
	)
	expect(child.status).toBe(1)
})
