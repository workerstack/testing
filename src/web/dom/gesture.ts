/*
 * The shape of a drag, as numbers: where the press goes down and every spot the pointer passes, one
 * per animation frame. The in-page pointer and the Playwright one both walk this path, so a drag
 * means the same thing in either. The 6px lift passes a drag engine's usual 5px threshold across
 * the list's axis, so the offset along the axis stays exact.
 */

/** A point in the viewport, in CSS pixels. */
export interface Spot {
	x: number
	y: number
}

/** The main axis of a list: `y` for a vertical one. */
export type Axis = "x" | "y"

/** A box in the viewport, as `getBoundingClientRect` and Playwright's `boundingBox` give it. */
export interface Box {
	x: number
	y: number
	width: number
	height: number
}

/** Pixels the lift moves across the axis. */
const LIFT = 6
/** Steps the lift takes. */
const LIFT_STEPS = 2
/** Steps from the lift to the target, by default. */
const STEPS = 16

export const centerOf = (box: Box): Spot => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 })

/** A spot 6px past a box's end (`after`) or before its start, on `axis`, centered on the other axis. */
export function beside(box: Box, side: "after" | "before", axis: Axis = "y"): Spot {
	const center = centerOf(box)
	if (axis === "y") return { x: center.x, y: side === "after" ? box.y + box.height + LIFT : box.y - LIFT }
	return { x: side === "after" ? box.x + box.width + LIFT : box.x - LIFT, y: center.y }
}

const across = (spot: Spot, axis: Axis, by: number): Spot =>
	axis === "y" ? { x: spot.x + by, y: spot.y } : { x: spot.x, y: spot.y + by }

/** The `steps` evenly spaced spots after `from` on the way to `to`, `to` last. */
export function line(from: Spot, to: Spot, steps: number): Spot[] {
	return Array.from({ length: steps }, (_, index) => ({
		x: from.x + ((to.x - from.x) * (index + 1)) / steps,
		y: from.y + ((to.y - from.y) * (index + 1)) / steps,
	}))
}

/** The spots a press at `from` moves through to pass the threshold: 6px across `axis`, in 2 steps. */
export const liftPath = (from: Spot, axis: Axis = "y"): Spot[] => line(from, across(from, axis, LIFT), LIFT_STEPS)

/** Where a drag from `from` to `to` presses, and the spots it moves through before it releases. */
export function dragPath(input: { from: Spot; to: Spot; axis?: Axis; steps?: number }): { press: Spot; path: Spot[] } {
	const { axis = "y", from, steps = STEPS, to } = input
	const lifted = liftPath(from, axis)
	return { path: [...lifted, ...line(across(from, axis, LIFT), across(to, axis, LIFT), steps)], press: from }
}

/** Where to aim a press on `grip` so the item, whose center is `middle`, ends centered on `to`. */
export const gripTarget = ({ grip, middle, to }: { grip: Spot; middle: Spot; to: Spot }): Spot => ({
	x: to.x - (middle.x - grip.x),
	y: to.y - (middle.y - grip.y),
})
