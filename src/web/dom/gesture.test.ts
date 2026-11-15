import { describe, expect, it } from "vitest"
import { beside, centerOf, dragPath, gripTarget } from "./gesture.ts"

const BOX = { height: 20, width: 100, x: 10, y: 40 }

describe("centerOf and beside", () => {
	it("finds a box's center", () => {
		expect(centerOf(BOX)).toEqual({ x: 60, y: 50 })
	})

	it("finds a spot 6px past either end of a box, on the list's axis, centered across it", () => {
		expect(beside(BOX, "after")).toEqual({ x: 60, y: 66 })
		expect(beside(BOX, "before")).toEqual({ x: 60, y: 34 })
		expect(beside(BOX, "after", "x")).toEqual({ x: 116, y: 50 })
		expect(beside(BOX, "before", "x")).toEqual({ x: 4, y: 50 })
	})
})

describe("dragPath", () => {
	it("presses, lifts 6px across a vertical list in 2 steps, then reaches the target in the given steps", () => {
		const { press, path } = dragPath({ from: { x: 0, y: 0 }, steps: 4, to: { x: 0, y: 100 } })
		expect(press).toEqual({ x: 0, y: 0 })
		expect(path).toEqual([
			{ x: 3, y: 0 },
			{ x: 6, y: 0 },
			{ x: 6, y: 25 },
			{ x: 6, y: 50 },
			{ x: 6, y: 75 },
			{ x: 6, y: 100 },
		])
	})

	it("lifts down across a horizontal list, and takes 16 steps by default", () => {
		const { path } = dragPath({ axis: "x", from: { x: 0, y: 0 }, to: { x: 160, y: 0 } })
		expect(path.slice(0, 2)).toEqual([
			{ x: 0, y: 3 },
			{ x: 0, y: 6 },
		])
		expect(path).toHaveLength(18)
		expect(path.at(-1)).toEqual({ x: 160, y: 6 })
	})
})

describe("gripTarget", () => {
	it("aims the press so the item's center, not the handle's, lands on the spot", () => {
		expect(gripTarget({ grip: { x: 10, y: 5 }, middle: { x: 50, y: 15 }, to: { x: 200, y: 300 } })).toEqual({
			x: 160,
			y: 290,
		})
	})
})
