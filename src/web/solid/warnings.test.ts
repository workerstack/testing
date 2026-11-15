import { afterEach, describe, expect, it } from "vitest"
import { recordWarnings } from "./warnings.ts"

/* The console as each test found it; a test that swaps a method puts it back here. */
const original = { error: console.error, warn: console.warn }

afterEach(() => {
	Object.assign(console, original)
})

/* Swaps in console methods that keep what they were called with. */
function printed(): unknown[][] {
	const calls: unknown[][] = []
	console.warn = (...args: unknown[]) => calls.push(["warn", ...args])
	console.error = (...args: unknown[]) => calls.push(["error", ...args])
	return calls
}

describe("recordWarnings", () => {
	it("records each warning and error as one line, and still prints them", () => {
		const calls = printed()
		const recorded = recordWarnings(() => {
			console.warn("signal written", 2)
			console.error(new Error("boom"))
			console.warn("near", { outerHTML: '<button data-slot="b" class="x">long</button>' })
			return "done"
		})
		expect(recorded).toEqual({
			result: "done",
			warnings: ["signal written 2", "Error: boom", 'near <button data-slot="b" class="x">'],
		})
		expect(calls.map(([kind, first]) => [kind, first instanceof Error ? first.message : first])).toEqual([
			["warn", "signal written"],
			["error", "boom"],
			["warn", "near"],
		])
	})

	it("puts the console back after the run, and after a run that throws", () => {
		const calls = printed()
		const { warn, error } = console
		recordWarnings(() => undefined)
		expect([console.warn, console.error]).toEqual([warn, error])
		expect(() =>
			recordWarnings(() => {
				throw new Error("render failed")
			}),
		).toThrow("render failed")
		expect([console.warn, console.error]).toEqual([warn, error])
		expect(calls).toEqual([])
	})

	it("waits for a run that returns a promise, and records until it settles", async () => {
		printed()
		const { warn } = console
		const pending = recordWarnings(async () => {
			await Promise.resolve()
			console.warn("late")
			return 7
		})
		expect(console.warn).not.toBe(warn)
		expect(await pending).toEqual({ result: 7, warnings: ["late"] })
		expect(console.warn).toBe(warn)
		await expect(recordWarnings(() => Promise.reject(new Error("no")))).rejects.toThrow("no")
		expect(console.warn).toBe(warn)
	})
})
