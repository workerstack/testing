# Solid server render and hydration

`@workerstack/testing/web/solid` tests a Solid 2 app's first load. It renders a component on the
server and reads its HTML the way a browser does. It then hydrates that HTML in the browser with
the same component and reports where the two renders disagree. `/web/solid/vitest` is the vite
plugin that renders on the server for a browser test.

```console
npm install -D @workerstack/testing vitest @vitest/browser-playwright solid-js @solidjs/web @solidjs/vite-plugin vite
```

A vitest config holds one Solid plugin, so the server tests and the hydration tests are two
projects, each in its own config file.

## Server render, in node

```ts
// vitest.server.config.ts
export default defineConfig({ plugins: [solid({ ssr: true })], test: { environment: "node" } })
```

```ts
import { renderServer, tag, tags, text } from "@workerstack/testing/web/solid"

const { html, warnings } = renderServer(() => <Button>Save &amp; close</Button>)
expect(tag(html, { "data-slot": "button" }).attrs["type"]).toBe("button")
expect(tags(html, "span").map((one) => one.text)).toEqual(["Save & close"])
expect(text(html)).toBe("Save & close")
expect(warnings).toEqual([])
```

- `renderServer(code)` runs Solid's `renderToString` and gives the HTML and every `console.warn`
  and `console.error` it logged. The warnings still print.
- `tags(html, match?)` gives every element in order: its lowercased `name`, its decoded `attrs`
  (a bare attribute is `""`) and its decoded `text`. `match` is a tag name, or attributes that
  must all be present with these values. It parses as a template's content does, so a component
  that renders only a table row keeps its cells.
- `tag(html, match)` gives the one element the match finds. None or more than one throws:

```console
Error: tag: expected one <* data-slot="button">, found 2 in: <div><button data-slot="button">…
```

- `recordWarnings(run)` records the warnings of any run, sync or async, as
  `{ result, warnings }`. The console is put back when the run returns, throws or settles.

## Hydration, in the browser

```ts
// vitest.hydration.config.ts
import { solidHydration } from "@workerstack/testing/web/solid/vitest"

export default defineConfig({
	plugins: [solid({ refresh: false, solid: { hydratable: true } }), solidHydration()],
	test: { browser: { enabled: true, instances: [{ browser: "chromium" }], provider: playwright() } },
})
```

```ts
// button.hydration.test.tsx; the fixtures live in button.fixture.tsx
import { hydrator } from "@workerstack/testing/web/solid"
import { ButtonFixture } from "./button.fixture.tsx"

const hydrate = hydrator(new URL("./button.fixture.tsx", import.meta.url), { ButtonFixture })

it("hydrates without a mismatch", async () => {
	const view = await hydrate("ButtonFixture")
	expect(view.mismatches).toEqual({})
})
```

`hydrate(name)` asks the plugin for the fixture's server HTML, puts it in a container on the
page, and hydrates it with the same export compiled for the browser. The view has the
`container`, the `server` render (`html` and `warnings`), the `mismatches` and `dispose`. It is
disposed after the test on its own: the root, the container, and Solid's `_$HY` state are all put
back. Call `dispose()` to do that sooner.

`mismatches` is `{}` for a clean hydration. Otherwise it has each kind that happened:

- `warnings`: Solid's mismatch logs, such as
  `Hydration tag mismatch for key "1": expected <i> but found <b _hk="1">`. A mismatch that
  hydration throws is one more warning.
- `serverWarnings`: what the server render warned.
- `replaced`: server elements hydration dropped, as `button[data-slot=button]`.
- `added`: elements hydration made that the server never sent.

The plugin's server loads each fixture with Solid compiled for the server. Pass `plugins` to add
what the app's code needs there, such as path aliases: `solidHydration({ plugins: [paths()] })`.

```console
Error: hydrate: no serverRender command; add solidHydration() to this project's plugins
Error: hydrate: runs in vitest's browser mode; this test runs in node
Error: hydrate: call it inside a test, so it is disposed after the test
Error: solidHydration: /button.fixture.tsx exports no ButtonFixture
```

## What Solid tells you

- Solid warns once per kind per process. A second test that hits the same kind of warning in the
  same file may see none, so put each warning case in its own file or test it first.
- A dev build logs what did not match. A production build only throws `Hydration Mismatch.`,
  which comes back as a warning with no detail. Run hydration tests on a dev build.
- `isMismatch(text)` says whether a log line is a hydration mismatch. `solidMismatches` is the
  same test as a page guard rule, so a Playwright test from [`/web`](web.md) fails on one:
  `test.use({ guard: { fail: solidMismatches } })`.
