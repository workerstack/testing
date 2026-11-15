import { onTestFinished } from "vitest"

/*
 * Browser APIs replaced with typed stand-ins, for a test that needs one to hold still: a
 * ResizeObserver that never reports, media queries that answer what the test says, an animation
 * that is over as soon as it starts. Each stub replaces the API even where it exists, and is undone
 * after the test that installed it, so no stub leaks into the next one.
 */

/** Undoes a stub. A second call does nothing. */
export type Restore = () => void

/** Puts `value` at `owner[key]`, and gives back how to put the old one back, or delete what was added. */
function replace(owner: object, key: string, value: unknown): Restore {
	const before = Object.getOwnPropertyDescriptor(owner, key)
	Object.defineProperty(owner, key, { configurable: true, value, writable: true })
	return () => {
		if (before === undefined) Reflect.deleteProperty(owner, key)
		else Object.defineProperty(owner, key, before)
	}
}

/** Registers the undo with the running test first, so a stub outside a test installs nothing. */
function install(name: string, put: () => Restore[]): Restore {
	let undo: Restore[] = []
	const restore = (): void => {
		for (const step of undo.toReversed()) step()
		undo = []
	}
	try {
		onTestFinished(restore)
	} catch (error) {
		throw new Error(`stubs.${name}: call it inside a test or a beforeEach, so it is undone after the test`, {
			cause: error,
		})
	}
	undo = put()
	return restore
}

class StubResizeObserver implements ResizeObserver {
	observe(): void {}
	unobserve(): void {}
	disconnect(): void {}
}

class StubMediaQueryList extends EventTarget implements MediaQueryList {
	readonly media: string
	readonly matches: boolean
	onchange: MediaQueryList["onchange"] = null
	constructor(media: string, matches: boolean) {
		super()
		this.media = media
		this.matches = matches
	}
	addListener(): void {}
	removeListener(): void {}
}

/* Built on first use: MouseEvent exists only where a DOM does. */
function stubPointerEvent(): typeof PointerEvent {
	return class extends MouseEvent implements PointerEvent {
		readonly altitudeAngle: number
		readonly azimuthAngle: number
		readonly height: number
		readonly isPrimary: boolean
		readonly persistentDeviceId = 0
		readonly pointerId: number
		readonly pointerType: string
		readonly pressure: number
		readonly tangentialPressure: number
		readonly tiltX: number
		readonly tiltY: number
		readonly twist: number
		readonly width: number
		constructor(type: string, init: PointerEventInit = {}) {
			super(type, init)
			this.altitudeAngle = init.altitudeAngle ?? Math.PI / 2
			this.azimuthAngle = init.azimuthAngle ?? 0
			this.height = init.height ?? 1
			this.isPrimary = init.isPrimary ?? true
			this.pointerId = init.pointerId ?? 1
			this.pointerType = init.pointerType ?? "mouse"
			this.pressure = init.pressure ?? 0
			this.tangentialPressure = init.tangentialPressure ?? 0
			this.tiltX = init.tiltX ?? 0
			this.tiltY = init.tiltY ?? 0
			this.twist = init.twist ?? 0
			this.width = init.width ?? 1
		}
		getCoalescedEvents(): PointerEvent[] {
			return []
		}
		getPredictedEvents(): PointerEvent[] {
			return []
		}
	}
}

class EmptyRectList implements DOMRectList {
	[index: number]: DOMRect
	readonly length = 0
	item(): DOMRect | null {
		return null
	}
	*[Symbol.iterator](): ArrayIterator<DOMRect> {}
}

/* An animation that is over as soon as it starts: the test sees the end state. */
class FinishedAnimation extends EventTarget implements Animation {
	currentTime: CSSNumberish | null = null
	effect: AnimationEffect | null = null
	readonly finished: Promise<Animation> = Promise.resolve(this)
	id = ""
	oncancel: Animation["oncancel"] = null
	onfinish: Animation["onfinish"] = null
	onremove: Animation["onremove"] = null
	readonly overallProgress: number | null = 1
	readonly pending = false
	readonly playState: AnimationPlayState = "finished"
	playbackRate = 1
	readonly ready: Promise<Animation> = Promise.resolve(this)
	readonly replaceState: AnimationReplaceState = "active"
	startTime: CSSNumberish | null = null
	timeline: AnimationTimeline | null = null
	cancel(): void {}
	commitStyles(): void {}
	finish(): void {}
	pause(): void {}
	persist(): void {}
	play(): void {}
	reverse(): void {}
	updatePlaybackRate(rate: number): void {
		this.playbackRate = rate
	}
}

/** A ResizeObserver that never reports. */
const resizeObserver = (): Restore =>
	install("resizeObserver", () => [replace(globalThis, "ResizeObserver", StubResizeObserver)])

/** `matchMedia`, matching what `matches` says of each query: nothing, by default. */
const matchMedia = (matches: (query: string) => boolean = () => false): Restore =>
	install("matchMedia", () => [
		replace(globalThis, "matchMedia", (query: string) => new StubMediaQueryList(query, matches(query))),
	])

/** A PointerEvent built on MouseEvent, for a DOM that has none. */
const pointerEvent = (): Restore =>
	install("pointerEvent", () => [replace(globalThis, "PointerEvent", stubPointerEvent())])

/** A Range with no layout: no client rects, an empty bounding rect. */
const rangeRects = (): Restore =>
	install("rangeRects", () => [
		replace(Range.prototype, "getClientRects", () => new EmptyRectList()),
		replace(Range.prototype, "getBoundingClientRect", () => new DOMRect()),
	])

/** `Element.animate`, with every animation already finished, and `getAnimations`, with none running. */
const animate = (): Restore =>
	install("animate", () => [
		replace(Element.prototype, "animate", () => new FinishedAnimation()),
		replace(Element.prototype, "getAnimations", () => []),
	])

/** Stand-ins for browser APIs, each undone after the test that installs it, or early by its `Restore`. */
export const stubs: {
	resizeObserver: typeof resizeObserver
	matchMedia: typeof matchMedia
	pointerEvent: typeof pointerEvent
	rangeRects: typeof rangeRects
	animate: typeof animate
} = { animate, matchMedia, pointerEvent, rangeRects, resizeObserver }
