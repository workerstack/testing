import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { createHydrator, type HydrationRuntime, type ServerRendered } from "./hydration.ts"

/*
 * Node has no DOM, so the page is a few objects that keep what happened to them: a container whose
 * elements a test chooses, and a MutationObserver that reports what the fake hydrate added.
 */
class FakeElement {
	isConnected = true
	constructor(
		readonly tagName: string,
		readonly attrs: Record<string, string> = {},
	) {}
	getAttribute(name: string): string | null {
		return this.attrs[name] ?? null
	}
}

interface Page {
	container: { innerHTML: string; elements: FakeElement[]; removed: number }
	appended: unknown[]
	added: FakeElement[]
}

function fakePage(elements: FakeElement[]): Page {
	const page: Page = {
		added: [],
		appended: [],
		container: {
			elements,
			innerHTML: "",
			removed: 0,
		},
	}
	const container = Object.assign(page.container, {
		querySelectorAll: () => page.container.elements,
		remove: () => {
			page.container.removed += 1
		},
	})
	vi.stubGlobal("document", {
		body: { append: (node: unknown) => page.appended.push(node) },
		createElement: () => container,
	})
	vi.stubGlobal(
		"MutationObserver",
		class {
			observe(): void {}
			disconnect(): void {}
			takeRecords(): Array<{ addedNodes: unknown[] }> {
				return [{ addedNodes: [...page.added, "a text node"] }]
			}
		},
	)
	vi.stubGlobal("Element", FakeElement)
	vi.stubGlobal("window", globalThis)
	return page
}

const SERVER: ServerRendered = { html: '<button data-slot="button">Save</button>', warnings: [] }

interface Calls {
	hydrated: number
	disposed: number
	flushed: number
	seen: unknown[]
}

/* A runtime whose hydrate runs `during` and records what it was handed. */
function runtime(during: () => void = () => undefined, server = SERVER): { runtime: HydrationRuntime; calls: Calls } {
	const calls: Calls = { disposed: 0, flushed: 0, hydrated: 0, seen: [] }
	return {
		calls,
		runtime: {
			browser: async () => ({
				commands: { serverRender: async (...args: unknown[]) => (calls.seen.push(...args), server) },
			}),
			flush: () => {
				calls.flushed += 1
			},
			hydrate: (code, container) => {
				calls.hydrated += 1
				calls.seen.push(code(), container)
				during()
				return () => {
					calls.disposed += 1
				}
			},
		},
	}
}

const FIXTURE = new URL("http://localhost:5173/tests/web/solid/button.fixture.tsx")
const fixtures = { ButtonFixture: () => "button" as never }

beforeEach(() => {
	Reflect.deleteProperty(globalThis, "_$HY")
})

afterEach(() => {
	vi.unstubAllGlobals()
	Reflect.deleteProperty(globalThis, "_$HY")
})

describe("createHydrator", () => {
	it("hydrates the server's HTML in a container on the page, and a clean hydration has no mismatches", async () => {
		const page = fakePage([new FakeElement("BUTTON", { "data-slot": "button" })])
		const { calls, runtime: live } = runtime(() => {
			expect(Reflect.get(globalThis, "_$HY")).toMatchObject({ done: false, events: [], r: {} })
		})
		const view = await createHydrator(live, FIXTURE, fixtures)("ButtonFixture")
		expect(calls.seen).toEqual(["/tests/web/solid/button.fixture.tsx", "ButtonFixture", "button", view.container])
		expect([calls.hydrated, calls.flushed]).toEqual([1, 1])
		expect(page.container.innerHTML).toBe(SERVER.html)
		expect(page.appended).toEqual([view.container])
		expect(view.server).toBe(SERVER)
		expect(view.mismatches).toEqual({})
	})

	it("reports each kind of disagreement, labeled, and only the kinds that happened, and keeps server warnings on server", async () => {
		const kept = new FakeElement("DIV")
		const thrown = new FakeElement("BUTTON", { "data-slot": "button" })
		const page = fakePage([kept, thrown])
		const fresh = new FakeElement("SPAN")
		const gone = new FakeElement("I")
		const { runtime: live } = runtime(
			() => {
				thrown.isConnected = false
				gone.isConnected = false
				page.added.push(fresh, gone)
				console.warn('Hydration key miss for "0-1": no server-rendered element carries this key')
				console.warn("unrelated")
			},
			{ html: "<div></div>", warnings: ["written on the server"] },
		)
		const print = vi.spyOn(console, "warn").mockImplementation(() => undefined)
		const view = await createHydrator(live, FIXTURE, fixtures)("ButtonFixture")
		print.mockRestore()
		expect({ mismatches: view.mismatches, serverWarnings: view.server.warnings }).toStrictEqual({
			mismatches: {
				added: ["span"],
				replaced: ["button[data-slot=button]"],
				warnings: ['Hydration key miss for "0-1": no server-rendered element carries this key'],
			},
			serverWarnings: ["written on the server"],
		})
	})
})

describe("a hydration that throws", () => {
	it("records a mismatch that hydration throws, and rethrows any other error after cleaning up", async () => {
		const page = fakePage([])
		const mismatch = runtime(() => {
			throw new Error("Hydration Mismatch. Unable to find DOM nodes for hydration key: 0-0")
		})
		const view = await createHydrator(mismatch.runtime, FIXTURE, fixtures)("ButtonFixture")
		expect(view.mismatches).toEqual({
			warnings: ["Hydration Mismatch. Unable to find DOM nodes for hydration key: 0-0"],
		})
		view.dispose()
		expect(mismatch.calls.disposed).toBe(0)
		const broken = runtime(() => {
			throw new Error("render failed")
		})
		await expect(createHydrator(broken.runtime, FIXTURE, fixtures)("ButtonFixture")).rejects.toThrow("render failed")
		expect(page.container.removed).toBe(2)
		expect("_$HY" in globalThis).toBe(false)
	})
})

describe("disposing", () => {
	it("disposes once: the root, the container and `_$HY`, which is deleted when there was none", async () => {
		const page = fakePage([])
		const { calls, runtime: live } = runtime()
		const view = await createHydrator(live, FIXTURE, fixtures)("ButtonFixture")
		view.dispose()
		view.dispose()
		expect([calls.disposed, page.container.removed]).toEqual([1, 1])
		expect("_$HY" in globalThis).toBe(false)
	})

	it("puts back a `_$HY` the page already had", async () => {
		fakePage([])
		const own = { done: true }
		Object.defineProperty(globalThis, "_$HY", { configurable: true, value: own, writable: false })
		const view = await createHydrator(runtime().runtime, FIXTURE, fixtures)("ButtonFixture")
		view.dispose()
		expect(Object.getOwnPropertyDescriptor(globalThis, "_$HY")).toEqual({
			configurable: true,
			enumerable: false,
			value: own,
			writable: false,
		})
	})
})

describe("a project without the plugin", () => {
	it("says to add the plugin when the project has no serverRender command", async () => {
		fakePage([])
		const live: HydrationRuntime = { ...runtime().runtime, browser: async () => ({ commands: {} }) }
		await expect(createHydrator(live, FIXTURE, fixtures)("ButtonFixture")).rejects.toThrow(
			"hydrate: no serverRender command; add solidHydration() to this project's plugins",
		)
	})
})

describe("a hydrated view left in place", () => {
	const page = { removed: 0 }
	it("is hydrated by one test", async () => {
		const fake = fakePage([])
		await createHydrator(runtime().runtime, FIXTURE, fixtures)("ButtonFixture")
		Object.defineProperty(page, "removed", { get: () => fake.container.removed })
		expect(page.removed).toBe(0)
	})

	it("was disposed when that test finished", () => {
		expect(page.removed).toBe(1)
	})
})

describe("outside a test", () => {
	let error: unknown
	beforeAll(async () => {
		fakePage([])
		await createHydrator(
			runtime().runtime,
			FIXTURE,
			fixtures,
		)("ButtonFixture").catch((caught: unknown) => {
			error = caught
		})
	})

	it("refuses from a beforeAll, before it renders anything", () => {
		expect((error as Error).message).toBe("hydrate: call it inside a test, so it is disposed after the test")
		expect((error as Error).cause).toBeInstanceOf(Error)
	})
})
