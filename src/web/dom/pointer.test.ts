import { afterEach, describe, expect, it, vi } from "vitest"
import type { Box, Spot } from "./gesture.ts"
import { pointer, type GestureEvent, type GestureInit, type Surface } from "./pointer.ts"

/* A stand-in element: a box, a parent, and `contains` over the parent chain. */
interface FakeElement {
	name: string
	parentElement: FakeElement | null
	getBoundingClientRect: () => Box
	contains: (other: FakeElement) => boolean
	dispatchEvent: (event: unknown) => boolean
}

function element(
	name: string,
	box: Box,
	{ dispatched = [], parent = null }: { parent?: Element | null; dispatched?: unknown[] } = {},
): Element {
	const self: FakeElement = {
		contains: (other) => {
			for (let at: FakeElement | null = other; at !== null; at = at.parentElement) if (at === self) return true
			return false
		},
		dispatchEvent: (event) => dispatched.push(event) > 0,
		getBoundingClientRect: () => box,
		name,
		parentElement: parent as unknown as FakeElement | null,
	}
	return self as unknown as Element
}

/* A bare class that stands for the browser's `name`. */
const standIn = (name: string): new () => object =>
	class {
		readonly standsFor = name
	}

const nameOf = (target: Element): string => (target as unknown as FakeElement).name

interface Sent {
	to: string
	type: GestureEvent
	init: GestureInit
}

/*
 * A surface that hits `pick(spot)`, records every event as it is sent and every frame as it passes,
 * and lets a test hand the held pointer's capture to an element with `capture`.
 */
function fakeSurface(pick: (spot: Spot) => Element): {
	surface: Surface
	log: Array<Sent | "frame">
	capture: (el: Element | null) => void
} {
	const log: Array<Sent | "frame"> = []
	let captor: Element | null = null
	const surface: Surface = {
		frame: async () => {
			log.push("frame")
		},
		hit: pick,
		hold: () => ({
			captor: () => captor,
			end: () => {
				captor = null
			},
		}),
		send: (target, type, init) => log.push({ init, to: nameOf(target), type }),
	}
	return {
		capture: (el) => {
			captor = el
		},
		log,
		surface,
	}
}

const sent = (log: Array<Sent | "frame">): Sent[] => log.filter((entry): entry is Sent => entry !== "frame")

const list = element("list", { height: 300, width: 100, x: 0, y: 0 })
const first = element("first", { height: 20, width: 100, x: 0, y: 0 }, { parent: list })
const last = element("last", { height: 20, width: 100, x: 0, y: 100 }, { parent: list })
const byY = (spot: Spot): Element => (spot.y < 50 ? first : last)

describe("pointer.create", () => {
	it("sends what a mouse sends: id 1, button 0 on press and release, -1 and held on a move", async () => {
		const { log, surface } = fakeSurface(byY)
		const mouse = pointer.create("mouse", surface)
		mouse.down({ x: 10, y: 10 })
		await mouse.move({ x: 10, y: 20 })
		mouse.up()
		const common = { isPrimary: true, pointerId: 1, pointerType: "mouse" }
		expect(sent(log).slice(0, 3)).toEqual([
			{ init: { ...common, button: 0, buttons: 1, clientX: 10, clientY: 10 }, to: "first", type: "pointerdown" },
			{ init: { ...common, button: -1, buttons: 1, clientX: 10, clientY: 20 }, to: "first", type: "pointermove" },
			{ init: { ...common, button: 0, buttons: 0, clientX: 10, clientY: 20 }, to: "first", type: "pointerup" },
		])
	})

	it("sends what a touch sends, with its own id, and no click on release", async () => {
		const { log, surface } = fakeSurface(byY)
		const touch = pointer.create("touch", surface)
		expect(touch.kind).toBe("touch")
		touch.down({ x: 10, y: 10 })
		touch.up()
		expect(sent(log).map((entry) => [entry.type, entry.init.pointerId, entry.init.pointerType])).toEqual([
			["pointerdown", 2, "touch"],
			["pointerup", 2, "touch"],
		])
	})

	it("moves in even steps, one frame after each", async () => {
		const { log, surface } = fakeSurface(byY)
		const mouse = pointer.create("mouse", surface)
		mouse.at = { x: 0, y: 0 }
		await mouse.move({ x: 30, y: 0 }, 3)
		expect(log.map((entry) => (entry === "frame" ? "frame" : entry.init.clientX))).toEqual([
			10,
			"frame",
			20,
			"frame",
			30,
			"frame",
		])
		expect(mouse.at).toEqual({ x: 30, y: 0 })
	})
})

describe("pointer.create, on release", () => {
	it("clicks the nearest element both the press and the release hit, once, where it released", async () => {
		const { log, surface } = fakeSurface(byY)
		const mouse = pointer.create("mouse", surface)
		mouse.down({ x: 10, y: 10 })
		expect(mouse.pressed).toBe(first)
		await mouse.move({ x: 10, y: 110 })
		mouse.up()
		expect(mouse.pressed).toBeNull()
		expect(sent(log).at(-1)).toEqual({ init: { clientX: 10, clientY: 110 }, to: "list", type: "click" })
		expect(sent(log).filter((entry) => entry.type === "click")).toHaveLength(1)
	})

	it("sends moves and the release to the captor, wherever the point is, and lets go on release", async () => {
		const item = element("item", { height: 20, width: 100, x: 0, y: 0 }, { parent: list })
		const grip = element("grip", { height: 10, width: 10, x: 0, y: 0 }, { parent: item })
		const { capture, log, surface } = fakeSurface((spot) => (spot.y < 50 ? grip : last))
		const mouse = pointer.create("mouse", surface)
		mouse.down({ x: 5, y: 5 })
		capture(item)
		await mouse.move({ x: 5, y: 110 })
		mouse.up()
		await mouse.move({ x: 5, y: 120 })
		expect(sent(log).map((entry) => `${entry.type} ${entry.to}`)).toEqual([
			"pointerdown grip",
			"pointermove item",
			"pointerup item",
			"click item",
			"pointermove last",
		])
	})

	it("sends no click for a release with no press, or with no element holding both", () => {
		const loose = element("loose", { height: 10, width: 10, x: 500, y: 500 })
		const { log, surface } = fakeSurface((spot) => (spot.x > 400 ? loose : first))
		const mouse = pointer.create("mouse", surface)
		mouse.up()
		mouse.down({ x: 10, y: 10 })
		mouse.at = { x: 500, y: 500 }
		mouse.up()
		expect(sent(log).map((entry) => entry.type)).toEqual(["pointerup", "pointerdown", "pointerup"])
	})
})

describe("pointer.create, by hand", () => {
	it("fires one event where it rests and returns the element it hit", () => {
		const { log, surface } = fakeSurface(byY)
		const mouse = pointer.create("mouse", surface)
		mouse.at = { x: 5, y: 105 }
		expect(mouse.fire("pointermove")).toBe(last)
		expect(sent(log)).toHaveLength(1)
	})

	it("lifts 6px across the axis in two frames, from the press", async () => {
		const { log, surface } = fakeSurface(byY)
		const mouse = pointer.create("mouse", surface)
		await mouse.lift({ x: 10, y: 10 }, "x")
		expect(sent(log).map((entry) => [entry.type, entry.init.clientX, entry.init.clientY])).toEqual([
			["pointerdown", 10, 10],
			["pointermove", 10, 13],
			["pointermove", 10, 16],
		])
		expect(log.filter((entry) => entry === "frame")).toHaveLength(2)
	})
})

describe("pointer.drag", () => {
	it("presses the handle's center, lifts, walks to an element's center off-axis, and releases with a click", async () => {
		const { log, surface } = fakeSurface(byY)
		await pointer.drag(first, { surface, to: last })
		const events = sent(log)
		expect(events[0]).toMatchObject({ init: { clientX: 50, clientY: 10 }, to: "first", type: "pointerdown" })
		expect(events.filter((entry) => entry.type === "pointermove")).toHaveLength(18)
		expect(events.at(-2)).toMatchObject({ init: { clientX: 56, clientY: 110 }, type: "pointerup" })
		expect(events.at(-1)).toMatchObject({ to: "list", type: "click" })
		expect(log.filter((entry) => entry === "frame")).toHaveLength(18)
	})

	it("walks to a spot along a horizontal list in the steps it is given", async () => {
		const { log, surface } = fakeSurface(byY)
		await pointer.drag(first, { axis: "x", steps: 4, surface, to: { x: 300, y: 10 } })
		const moves = sent(log).filter((entry) => entry.type === "pointermove")
		expect(moves).toHaveLength(6)
		expect(moves.at(-1)?.init).toMatchObject({ clientX: 300, clientY: 16 })
	})
})

describe("pointer.dragCenterTo", () => {
	it("grips the handle so the item's center, not the handle's, lands on the spot", async () => {
		const item = element("item", { height: 40, width: 100, x: 0, y: 0 }, { parent: list })
		const handle = element("handle", { height: 10, width: 10, x: 0, y: 0 }, { parent: item })
		const { log, surface } = fakeSurface(() => handle)
		await pointer.dragCenterTo({ handle, item, surface, to: { x: 50, y: 200 } })
		expect(sent(log)[0]?.init).toMatchObject({ clientX: 5, clientY: 5 })
		expect(sent(log).at(-2)?.init).toMatchObject({ clientX: 11, clientY: 185 })
	})
})

describe("pointer.centerOf and pointer.beside", () => {
	it("read an element's box", () => {
		expect(pointer.centerOf(last)).toEqual({ x: 50, y: 110 })
		expect(pointer.beside(last, "after")).toEqual({ x: 50, y: 126 })
		expect(pointer.beside(last, "before", "x")).toEqual({ x: -6, y: 110 })
	})
})

afterEach(() => {
	vi.unstubAllGlobals()
})

describe("the page surface", () => {
	it("hits the element under a spot, or the body over nothing", () => {
		const body = element("body", { height: 0, width: 0, x: 0, y: 0 })
		const hits: Spot[] = []
		vi.stubGlobal("document", {
			body,
			elementFromPoint: (x: number, y: number) => {
				hits.push({ x, y })
				return x > 100 ? null : first
			},
		})
		vi.stubGlobal("PointerEvent", standIn("PointerEvent"))
		const mouse = pointer.create("mouse", undefined)
		mouse.at = { x: 5, y: 6 }
		expect(mouse.fire("pointermove")).toBe(first)
		mouse.at = { x: 200, y: 6 }
		expect(nameOf(mouse.fire("pointermove"))).toBe("body")
		expect(hits).toEqual([
			{ x: 5, y: 6 },
			{ x: 200, y: 6 },
		])
	})

	it("dispatches a bubbling, composed PointerEvent, a MouseEvent click, and waits on requestAnimationFrame", async () => {
		const made: Array<[string, string, object]> = []
		const record = (kind: string) =>
			class {
				readonly kind = kind
				constructor(type: string, init: object) {
					made.push([kind, type, init])
				}
			}
		const dispatched: unknown[] = []
		const target = element("target", { height: 10, width: 10, x: 0, y: 0 }, { dispatched })
		vi.stubGlobal("Element", standIn("Element"))
		vi.stubGlobal("document", { body: target, elementFromPoint: () => target })
		vi.stubGlobal("PointerEvent", record("PointerEvent"))
		vi.stubGlobal("MouseEvent", record("MouseEvent"))
		vi.stubGlobal("requestAnimationFrame", (done: () => void) => setTimeout(done, 0))
		const mouse = pointer.create()
		mouse.down({ x: 1, y: 2 })
		await mouse.move({ x: 1, y: 3 })
		mouse.up()
		await pointer.frames(2)
		await pointer.frames(0)
		const flags = { bubbles: true, cancelable: true, composed: true }
		expect(made.map(([kind, type]) => `${kind} ${type}`)).toEqual([
			"PointerEvent pointerdown",
			"PointerEvent pointermove",
			"PointerEvent pointerup",
			"MouseEvent click",
		])
		expect(made[0]?.[2]).toMatchObject({ ...flags, clientX: 1, clientY: 2, pointerId: 1 })
		expect(made[3]?.[2]).toEqual({ ...flags, clientX: 1, clientY: 3 })
		expect(dispatched).toHaveLength(4)
	})
})
