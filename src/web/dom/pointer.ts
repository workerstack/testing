import { hold, type Capture } from "./capture.ts"
import {
	beside as besideBox,
	centerOf as centerOfBox,
	dragPath,
	gripTarget,
	liftPath,
	line,
	type Axis,
	type Spot,
} from "./gesture.ts"

/*
 * Pointer input for tests that run in the page. Vitest's user events have no press, move and
 * release, so this sends the events a real mouse or touchscreen sends, at real coordinates, to the
 * element under the point, one animation frame after each move. A drag walks the same path the
 * Playwright `pointer` fixture walks.
 */

/** Which pointer drives a gesture. */
export type PointerKind = "mouse" | "touch"

/** The events a gesture sends: a mouse adds a click after its release. */
export type GestureEvent = "pointerdown" | "pointermove" | "pointerup" | "click"

/** What an event carries; a click carries only where it happened. */
export interface GestureInit {
	clientX: number
	clientY: number
	button?: number
	buttons?: number
	pointerId?: number
	pointerType?: PointerKind
	isPrimary?: boolean
}

/** Where a gesture lands: the page by default, or a stand-in a test passes. */
export interface Surface {
	/** The element under `spot`. */
	hit(spot: Spot): Element
	/** Builds the event and sends it to `target`. */
	send(target: Element, type: GestureEvent, init: GestureInit): void
	/** Resolves after the next animation frame. */
	frame(): Promise<void>
	/** Keeps pointer `id`'s capture from its press until the release. */
	hold(id: number): Capture
}

/** A pointer that presses, moves and releases like a real one. */
export interface Pointer {
	readonly kind: PointerKind
	/** Where it is now; set it to place the next `fire`. */
	at: Spot
	/** The element the press went down on, until the release. */
	readonly pressed: Element | null
	/** Sends one pointer event at `at`, to the element holding its capture or else the one under it, and returns it. */
	fire(type: Exclude<GestureEvent, "click">): Element
	/** Presses at `spot`. */
	down(spot: Spot): void
	/** Moves to `to` in `steps`, a frame after each. */
	move(to: Spot, steps?: number): Promise<void>
	/** Releases; a mouse then clicks the nearest element both the press and the release hit. */
	up(): void
	/** Presses at `from` and moves 6px across `axis` in two steps, past a drag engine's 5px threshold. */
	lift(from: Spot, axis?: Axis): Promise<void>
}

/** A drag's target and pace. */
export interface DragOptions {
	/** An element, whose center the drag ends on, or a spot. */
	to: Element | Spot
	/** The list's main axis. @default "y" */
	axis?: Axis
	/** Steps from the lift to the target. @default 16 */
	steps?: number
	/** Where the drag lands. @default the page */
	surface?: Surface
}

/** A drag by a handle until its item's center sits on `to`, since a handle is rarely centered. */
export interface CenterDrag {
	handle: Element
	item: Element
	to: Spot
	axis?: Axis
	surface?: Surface
}

/** Frames that pass with nothing to show, for asserting that nothing happens. */
const QUIET_FRAMES = 6
/** A mouse and a touch never share a pointer id. */
const POINTER_ID: Record<PointerKind, number> = { mouse: 1, touch: 2 }
/** The buttons held during each event: none once released. */
const BUTTONS = { pointerdown: 1, pointermove: 1, pointerup: 0 } as const
/** The button each event reports; a move changes none, which is -1. */
const BUTTON = { pointerdown: 0, pointermove: -1, pointerup: 0 } as const
const FLAGS = { bubbles: true, cancelable: true, composed: true } as const

const nextFrame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()))

const PAGE: Surface = {
	frame: nextFrame,
	hold,
	hit: ({ x, y }) => document.elementFromPoint(x, y) ?? document.body,
	send: (target, type, init) => {
		target.dispatchEvent(
			type === "click" ? new MouseEvent(type, { ...FLAGS, ...init }) : new PointerEvent(type, { ...FLAGS, ...init }),
		)
	},
}

/** The nearest element that holds both `a` and `b`. */
function commonAncestor(a: Element, b: Element): Element | null {
	let common: Element | null = a
	while (common !== null && !common.contains(b)) common = common.parentElement
	return common
}

/** A pointer of `kind`, resting at the viewport's corner. */
function create(kind: PointerKind = "mouse", surface: Surface = PAGE): Pointer {
	const id = POINTER_ID[kind]
	let pressed: Element | null = null
	let capture: Capture | null = null
	const self: Pointer = {
		at: { x: 0, y: 0 },
		down: (spot) => {
			self.at = spot
			capture?.end()
			capture = surface.hold(id)
			pressed = self.fire("pointerdown")
		},
		fire: (type) => {
			const target = capture?.captor() ?? surface.hit(self.at)
			const init = { button: BUTTON[type], buttons: BUTTONS[type], isPrimary: true, pointerId: id }
			surface.send(target, type, { ...init, clientX: self.at.x, clientY: self.at.y, pointerType: kind })
			return target
		},
		kind,
		lift: async (from, axis = "y") => {
			self.down(from)
			await walk(liftPath(from, axis))
		},
		move: (to, steps = 1) => walk(line(self.at, to, steps)),
		get pressed() {
			return pressed
		},
		up: () => {
			const released = self.fire("pointerup")
			const held = pressed
			/* A browser lets go of a capture on release, after the pointerup. */
			capture?.end()
			capture = null
			pressed = null
			if (kind !== "mouse" || held === null) return
			const common = commonAncestor(released, held)
			if (common !== null) surface.send(common, "click", { clientX: self.at.x, clientY: self.at.y })
		},
	}
	async function walk(path: Spot[]): Promise<void> {
		for (const spot of path) {
			self.at = spot
			self.fire("pointermove")
			await surface.frame()
		}
	}
	return self
}

const centerOf = (el: Element): Spot => centerOfBox(el.getBoundingClientRect())

/** A spot 6px past an element's end (`after`) or before its start, on `axis`, centered across it. */
const beside = (el: Element, side: "after" | "before", axis: Axis = "y"): Spot =>
	besideBox(el.getBoundingClientRect(), side, axis)

/** Presses the handle's center, lifts, walks to `to` kept 6px off-axis, and releases, with a mouse. */
async function drag(handle: Element, options: DragOptions): Promise<void> {
	const { axis = "y", steps, surface, to } = options
	const mouse = create("mouse", surface)
	const target = "getBoundingClientRect" in to ? centerOf(to) : to
	const { path, press } = dragPath({
		axis,
		from: centerOf(handle),
		to: target,
		...(steps === undefined ? {} : { steps }),
	})
	mouse.down(press)
	try {
		for (const spot of path) await mouse.move(spot)
	} finally {
		mouse.up()
	}
}

/** Drags by the handle until the item's center sits on `to`. */
const dragCenterTo = ({ handle, item, to, ...pace }: CenterDrag): Promise<void> =>
	drag(handle, { ...pace, to: gripTarget({ grip: centerOf(handle), middle: centerOf(item), to }) })

/** Resolves after `count` animation frames, for asserting that nothing happens. */
async function frames(count: number = QUIET_FRAMES): Promise<void> {
	for (let left = count; left > 0; left--) await nextFrame()
}

/** In-page pointer input: `create` a pointer, or `drag` with a mouse. */
export const pointer: {
	create: typeof create
	drag: typeof drag
	dragCenterTo: typeof dragCenterTo
	centerOf: typeof centerOf
	beside: typeof beside
	frame: typeof nextFrame
	frames: typeof frames
} = { beside, centerOf, create, drag, dragCenterTo, frame: nextFrame, frames }
