# Web tests

`@workerstack/testing/web` gives Playwright tests a page that fails the test when it throws or logs
an error, helpers that wait on the page instead of the clock, an accessibility scan, a network
gate that fails a request to an origin the test did not declare, and an app server on a free port.

Install Playwright beside it, and axe if you scan. Both are optional peers, so only a project that
tests a web app needs them:

```console
npm install -D @workerstack/testing @playwright/test @axe-core/playwright
```

## `test`

`test` is Playwright's `test` with the `page` guarded, every request gated, the `guard` and
`a11yDefaults` options, and the `ready`, `a11y` and `network` fixtures.
Use it in place of Playwright's, and extend it with your own fixtures the usual way:

```ts
import { expect, test as web } from "@workerstack/testing/web"

export const test = web.extend<{ account: string }>({ account: async ({}, use) => use("demo") })
export { expect }
```

## `guard`

After each test, the guard fails it on every page error and every `console.error` the page said,
one line each:

```console
Error: guard: console.error at /console-error.html: "boom" (guard.spec.ts:7)
Error: guard: pageerror at /page-error.html: "notDefined is not defined" (guard.spec.ts:12)
```

Set `guard` with `test.use`, for a file or a `describe`:

```ts
test.use({
	guard: {
		fail: [{ kind: "warning", text: "Hydration mismatch" }],
		ignore: [{ text: /ResizeObserver loop/, reason: "browser noise, no app impact" }],
	},
})
```

- `text` is a string, matched as a substring, or a `RegExp`.
- `kind` is `pageerror` or a console method such as `error`, `warning` or `log`. A match without
  `kind` matches every kind.
- `fail` adds what fails the test, on top of page errors and console errors.
- `ignore` lets a match through, and wins over `fail`. Every ignore says why. A blank `reason`
  fails the test before it runs:

```console
Error: guard: ignore /ResizeObserver loop/ has no reason; say why the app may log it
```

## `ready`

`ready.goto(path, { marker, timeout })` opens `path`, then waits for `marker` to be in the page.
Make the app set a marker once it is usable, such as `data-hydrated` on `<html>` after hydration,
and no test sleeps. `timeout` is in milliseconds and defaults to 5000. When the marker never shows:

```console
Error: ready.goto: /late.html never showed html[data-hydrated] (timeout 5000ms)
```

`ready.settle(locator)` waits until the element, and everything under it, stops animating. It
waits for each running animation that ends, then a frame, and looks again. It skips an infinite
animation, a spinner say, and counts a canceled one as done. Use it before a screenshot, or before
a click on something that slides in.

```ts
test("the dialog opens", async ({ page, ready }) => {
	await ready.goto("/", { marker: "html[data-hydrated]" })
	await page.getByRole("button", { name: "Open" }).click()
	await ready.settle(page.locator("dialog"))
	await expect(page.locator("dialog")).toHaveScreenshot()
})
```

## `a11y`

`a11y.check(options)` scans the page, as it is at that moment, for WCAG 2.2 level AA violations
(the axe tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`). It fails with one line per
element:

```console
Error: a11y: image-alt at img.hero: Images must have alternative text
```

- `include` limits the scan to one selector.
- `exclude` skips elements, and `disable` skips axe rules by id. Each says why; a blank `reason`
  fails the call before it scans:

```console
Error: a11y: exclude "[data-focus-guard]" has no reason; say why it may fail
Error: a11y: disable "region" has no reason; say why it may fail
```

`a11yDefaults`, set with `test.use`, comes before each call's own options:

```ts
test.use({ a11yDefaults: { exclude: [{ selector: "[data-focus-guard]", reason: "inert focus sentinel" }] } })
test("home", async ({ page, a11y }) => {
	await page.goto("/")
	await a11y.check({ include: "main", disable: [{ rule: "region", reason: "a fragment, not a page" }] })
})
```

axe loads on the first scan. Without `@axe-core/playwright` installed, the rest of `/web` works,
and a scan fails with:

```console
Error: a11y: needs @axe-core/playwright; run npm install -D @axe-core/playwright
```

## `network`

Every test is gated, whether it names `network` or not. A request reaches the network only when its
origin is the app's own (the `baseURL` origin) or one the test allowed. Any other request is
aborted, and the test fails after it runs, one line per request:

```console
Error: network: GET https://cdn.example.invalid/x.js from /external.html: origin not declared; call network.allow
```

`network.allow(origin)` lets an origin through. With `fulfill`, it answers every request to that
origin instead, with what Playwright's `route.fulfill` takes. The stub gets
`access-control-allow-origin: *` unless its `headers` set one or it passes a whole `response`, so
the page can read it across origins:

```ts
test("map", async ({ page, network }) => {
	network.allow("https://tiles.example.com", { fulfill: { json: { tiles: [] } } })
	await page.goto("/map")
})
```

`allow` takes an origin, `scheme://host[:port]`, and nothing longer:

```console
Error: network.allow: "https://cdn.example.com/x.js" is not an origin; pass scheme://host[:port]
```

What else to know:

- With no `baseURL`, each origin the page navigates to becomes the app's own, a redirect too.
- A test's own `page.route` answers before the gate, so a request it stubs is declared by that stub.
- `data:`, `blob:` and `about:` URLs never leave the browser and always pass.
- The guard does not also report Chromium's `Failed to load resource: net::ERR_BLOCKED_BY_CLIENT`
  for a blocked request; the network line names it.
- The gate routes every request, and in Playwright routing turns off the browser's HTTP cache.
- WebSockets and requests a service worker makes are not gated.

## `appServer` and `defineWebConfig`

`appServer` starts your app for the run on a port the OS picked, so two runs never fight over a
port and no retry hides a collision. `defineWebConfig` is Playwright's `defineConfig` with a
`server` in place of `webServer`:

```ts
// playwright.config.ts
import { appServer, defineWebConfig } from "@workerstack/testing/web"

const app = await appServer({ command: "vite preview --port {port} --strictPort" })
const dev = await appServer({ name: "dev", command: "vite dev --port {port} --strictPort" })

export default defineWebConfig({
	server: [app, dev],
	testDir: "e2e",
	projects: [
		{ name: "preview", use: { baseURL: app.url } },
		{ name: "dev", use: { baseURL: dev.url } },
	],
})
```

- `{port}` in `command` and in `env` values is the port. `PORT` holds it too, for an app that
  reads it.
- Playwright starts each server before the tests, waits until `url` plus `path` (default `/`)
  answers, and stops the server and every process it started when the run ends. A server is
  never reused: if the port already answers, the run fails.
- `timeout` is how long the app may take to answer, 30000 ms by default. Build the app before
  the run (`npm run build && playwright test`), not in `command`, so it starts in seconds.
- `name` labels the server's log lines and defaults to `app`. Two servers need two names.
- The first server is `use.baseURL` unless you set one. `forbidOnly` is on when `CI` is set.
- Pass `--strictPort` or your server's flag for it, so a port taken in the meantime fails the run
  instead of moving the app somewhere the tests do not look.

The config awaits `appServer`, so it must be an ES module (`"type": "module"`, or a `.mts`
config). Playwright loads the config again in every worker; the port is kept in
`WORKERSTACK_WEB_PORT_<NAME>`, which each worker inherits, so all of them reach the same server.
A Playwright run started from inside another inherits that variable too; remove it from the
inner run's env.

When a server fails:

```console
Error: Process from config.webServer was not able to start. Exit code: 1
Error: Timed out waiting 30000ms from config.webServer.
Error: appServer: name "Dev" must be lowercase letters, digits and dashes
Error: defineWebConfig: two servers are named "app"; give each its own name
```
