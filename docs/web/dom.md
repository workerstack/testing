# In-page tests

`@workerstack/testing/web/dom` is for tests that run inside the page, such as vitest browser
tests. It has a `pointer` that presses, moves and releases like a real one, and `stubs` that
replace a browser API for one test and put it back after it. It imports only itself and vitest,
so it never loads Playwright into the page.

```console
npm install -D @workerstack/testing vitest @vitest/browser-playwright
```

## `pointer`

```ts
import { pointer } from "@workerstack/testing/web/dom"

await pointer.drag(handle, { to: target }) // target: an element or a { x, y }
await pointer.drag(handle, { to: { x: 300, y: 40 }, axis: "x", steps: 8 })
await pointer.dragCenterTo({ handle, item, to: pointer.beside(last, "after") })
```

A drag sends the pointer events a mouse sends, at real coordinates, to the element under the
point. It presses the handle's center, moves 6px across the list's axis in 2 steps to pass a drag
engine's 5px threshold, walks to the target in 16 steps kept 6px off-axis, and releases. It waits
one animation frame after every move. The `pointer` fixture in [`/web`](web.md) walks the same path.

- On release, a mouse clicks the nearest element that holds both the press and the release
  targets, as a browser does. A touch sends no click.
- An element that calls `setPointerCapture` from its press handler gets every move and the
  release until the pointer is let go, wherever the point is. A browser ignores capture for a
  pointer it did not see go down, and throws for a touch, so the pointer keeps the capture
  itself while it is held. It sends no `gotpointercapture` or `lostpointercapture`.
- `pointer.centerOf(el)` and `pointer.beside(el, "after" | "before", axis)` give spots to aim at.
  `beside` is 6px past the element's end, or before its start.
- `pointer.frame()` waits one animation frame. `pointer.frames(n)` waits `n`, 6 by default, for
  asserting that nothing happens.

For a gesture by hand, or a touch, create a pointer and drive it:

```ts
const touch = pointer.create("touch")
await touch.lift(pointer.centerOf(row)) // press, then 6px across the axis
await touch.move(pointer.beside(last, "after"), 8)
touch.up()
```

`at` is where the pointer is; set it to place the next `fire("pointermove")`. `pressed` is the
element the press went down on, until the release. Release every pointer you press: `drag`
always does, even when a step throws.

## `stubs`

```ts
import { stubs } from "@workerstack/testing/web/dom"

beforeEach(() => {
	stubs.resizeObserver() // undone after each test
})

it("follows the reduced-motion setting", () => {
	const restore = stubs.matchMedia((query) => query.includes("reduce"))
	// ...
	restore() // or undo it early
})
```

| Stub                   | What it puts in                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------- |
| `resizeObserver()`     | a `ResizeObserver` that never reports                                                  |
| `matchMedia(matches?)` | `matchMedia`, matching what `matches(query)` says; nothing matches by default          |
| `pointerEvent()`       | a `PointerEvent` built on `MouseEvent`, for a DOM that has none                        |
| `rangeRects()`         | a `Range` with no client rects and an empty bounding rect                              |
| `animate()`            | `Element.animate` with every animation already finished, and `getAnimations` with none |

Each stub replaces the API even where the browser has it, and is undone after the test that
installed it: the original comes back, or what the stub added is deleted. The `restore` it
returns undoes it early; a second call does nothing. A stub must be called inside a test or a
`beforeEach`, so there is a test to undo it after:

```console
Error: stubs.resizeObserver: call it inside a test or a beforeEach, so it is undone after the test
```
