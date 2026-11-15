import { expect, test } from "@playwright/test"
import { CHILD_TIMEOUT_MS, childEnv, runChild } from "../support/child-run.ts"

/*
 * The package as a consumer meets it: a Playwright project under tests/web/consumer imports
 * `@workerstack/testing/web` by name (the build `test:web` makes first) and runs against the
 * fixture pages. Each spec there either passes, or fails with the line a user would read.
 */

test("a child run gets none of this run's worker or kept-port variables", () => {
	process.env["WORKERSTACK_WEB_PORT_APP"] = "40001"
	try {
		const env = childEnv({ EXTRA: "1" })
		expect(env["WORKERSTACK_WEB_PORT_APP"]).toBeUndefined()
		expect(env["TEST_WORKER_INDEX"]).toBeUndefined()
		expect(env).toMatchObject({ EXTRA: "1", FORCE_COLOR: "0" })
	} finally {
		delete process.env["WORKERSTACK_WEB_PORT_APP"]
	}
})

test("a consumer project fails exactly the specs whose page went wrong, with the line a user reads", async () => {
	test.setTimeout(CHILD_TIMEOUT_MS)
	const child = runChild("tests/web/consumer/playwright.config.ts")
	const found = child.specs
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
		"a clean page passes the accessibility scan": "passed",
		"an image with no alt fails the scan with the rule and the node": "failed",
		"an excluded image passes when the exclude says why": "passed",
		"an exclude with a blank reason fails before it scans": "failed",
		"a script from an undeclared origin fails the test": "failed",
		"an allowed origin answers with its stub, across origins": "passed",
		"a page.route stub answers before the gate": "passed",
		"allow refuses a path where an origin belongs": "failed",
		"a drag reorders the list": "passed",
		"dragCenterTo lands the item past the last one": "passed",
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
	expect(message("an image with no alt fails the scan with the rule and the node")).toContain(
		"a11y: image-alt at img: Images must have alternative text",
	)
	expect(message("an exclude with a blank reason fails before it scans")).toContain(
		'a11y: exclude "img" has no reason; say why it may fail',
	)
	expect(message("a script from an undeclared origin fails the test")).toContain(
		"network: GET https://cdn.example.invalid/x.js from /external.html: origin not declared; call network.allow",
	)
	expect(message("a script from an undeclared origin fails the test")).not.toContain("guard:")
	expect(message("allow refuses a path where an origin belongs")).toContain(
		'network.allow: "https://tiles.example.invalid/tiles.json" is not an origin; pass scheme://host[:port]',
	)
	expect(child.code).toBe(1)
})
