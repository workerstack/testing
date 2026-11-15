import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { stubs } from "./stubs.ts"

/* Node has none of these DOM classes, so each test that needs one sets a bare stand-in, cleared after it. */
class FakeMouseEvent extends Event {
	readonly clientX: number
	constructor(type: string, init: MouseEventInit = {}) {
		super(type, init)
		this.clientX = init.clientX ?? 0
	}
}

/* A bare class that stands for the browser's `name`. */
const standIn = (name: string): new () => object =>
	class {
		readonly standsFor = name
	}

beforeEach(() => {
	vi.stubGlobal("Element", standIn("Element"))
	vi.stubGlobal("Range", standIn("Range"))
	vi.stubGlobal("DOMRect", standIn("DOMRect"))
	vi.stubGlobal("MouseEvent", FakeMouseEvent)
})

afterEach(() => {
	vi.unstubAllGlobals()
})

const OUTSIDE = "call it inside a test or a beforeEach, so it is undone after the test"

describe("stubs.resizeObserver", () => {
	it("puts in a ResizeObserver that never reports, and restore takes it out again, once", () => {
		const restore = stubs.resizeObserver()
		const observer = new ResizeObserver(() => {
			throw new Error("a stub never reports")
		})
		observer.observe(new Element())
		observer.unobserve(new Element())
		observer.disconnect()
		restore()
		expect("ResizeObserver" in globalThis).toBe(false)
		vi.stubGlobal("ResizeObserver", "set since")
		restore()
		expect(globalThis.ResizeObserver).toBe("set since")
	})

	it("replaces one that is already there, and restore puts that one back", () => {
		const own = standIn("ResizeObserver")
		vi.stubGlobal("ResizeObserver", own)
		const restore = stubs.resizeObserver()
		expect(globalThis.ResizeObserver).not.toBe(own)
		restore()
		expect(globalThis.ResizeObserver).toBe(own)
	})
})

describe("a stub left in place", () => {
	it("is installed by one test", () => {
		stubs.matchMedia(() => true)
		expect(matchMedia("print").matches).toBe(true)
	})

	it("is gone in the next", () => {
		expect("matchMedia" in globalThis).toBe(false)
	})
})

describe("outside a test", () => {
	let error: unknown
	beforeAll(() => {
		try {
			stubs.resizeObserver()
		} catch (caught) {
			error = caught
		}
	})

	it("refuses from a beforeAll, names the stub, and installs nothing", () => {
		expect(error).toBeInstanceOf(Error)
		expect((error as Error).message).toBe(`stubs.resizeObserver: ${OUTSIDE}`)
		expect((error as Error).cause).toBeInstanceOf(Error)
		expect("ResizeObserver" in globalThis).toBe(false)
	})
})

describe("stubs.matchMedia", () => {
	it("answers each query with what the function says, and nothing matches by default", () => {
		const restore = stubs.matchMedia((query) => query.includes("reduce"))
		const reduce = matchMedia("(prefers-reduced-motion: reduce)")
		expect([reduce.matches, reduce.media, reduce.onchange]).toEqual([true, "(prefers-reduced-motion: reduce)", null])
		reduce.addListener(() => undefined)
		reduce.removeListener(() => undefined)
		restore()
		stubs.matchMedia()
		expect(matchMedia("(prefers-reduced-motion: reduce)").matches).toBe(false)
	})
})

describe("stubs.pointerEvent", () => {
	it("puts in a PointerEvent built on MouseEvent, with the init's values or a primary mouse's", () => {
		stubs.pointerEvent()
		const plain = new PointerEvent("pointerdown")
		expect(plain).toBeInstanceOf(FakeMouseEvent)
		expect(plain).toMatchObject({
			height: 1,
			isPrimary: true,
			pointerId: 1,
			pointerType: "mouse",
			pressure: 0,
			width: 1,
		})
		expect([plain.altitudeAngle, plain.azimuthAngle, plain.tiltX, plain.tiltY, plain.twist]).toEqual([
			Math.PI / 2,
			0,
			0,
			0,
			0,
		])
		expect([plain.tangentialPressure, plain.persistentDeviceId]).toEqual([0, 0])
		expect([plain.getCoalescedEvents(), plain.getPredictedEvents()]).toEqual([[], []])
		const init = {
			altitudeAngle: 1,
			azimuthAngle: 2,
			clientX: 7,
			height: 3,
			isPrimary: false,
			pointerId: 4,
			pointerType: "touch",
			pressure: 0.5,
			tangentialPressure: 0.25,
			tiltX: 5,
			tiltY: 6,
			twist: 8,
			width: 9,
		}
		expect(new PointerEvent("pointermove", init)).toMatchObject(init)
	})
})

describe("stubs.rangeRects", () => {
	it("gives a Range no client rects and an empty bounding rect", () => {
		stubs.rangeRects()
		const range = new Range()
		const rects = range.getClientRects()
		expect([rects.length, rects.item(0), [...rects]]).toEqual([0, null, []])
		expect(range.getBoundingClientRect()).toBeInstanceOf(DOMRect)
	})
})

describe("stubs.animate", () => {
	it("gives every element an animation that is already over, and none running", async () => {
		stubs.animate()
		const element = new Element()
		const animation = element.animate([], 100)
		expect(animation).toMatchObject({ pending: false, playState: "finished", playbackRate: 1 })
		expect(await animation.finished).toBe(animation)
		expect(await animation.ready).toBe(animation)
		for (const call of ["cancel", "commitStyles", "finish", "pause", "persist", "play", "reverse"] as const)
			animation[call]()
		animation.updatePlaybackRate(2)
		expect(animation.playbackRate).toBe(2)
		expect(element.getAnimations()).toEqual([])
	})
})
