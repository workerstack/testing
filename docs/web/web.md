# Web tests

`@workerstack/testing/web` gives Playwright tests two things: a page that fails the test when it
throws or logs an error, and helpers that wait on the page instead of the clock.

Install Playwright beside it. It is an optional peer, so only a project that tests a web app needs it:

```console
npm install -D @workerstack/testing @playwright/test
```

## `test`

`test` is Playwright's `test` with the `page` guarded, a `guard` option and a `ready` fixture.
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
