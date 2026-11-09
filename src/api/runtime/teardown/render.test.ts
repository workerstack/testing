import { describe, expect, it } from "vitest"
import { renderTeardown } from "./render.ts"
import type { TeardownReport, UnidentifiedCreate } from "./types.ts"

const report = (fields: Partial<TeardownReport> = {}): TeardownReport => ({
	failed: [],
	records: [],
	removed: 0,
	unidentified: [],
	unsupported: [],
	...fields,
})

const create = (seq: number): UnidentifiedCreate => ({
	entity: "note",
	method: "POST",
	operationId: "notes.create",
	seq,
	status: 201,
	url: "http://api.test/notes",
})

describe("renderTeardown", () => {
	it("says nothing when nothing was created or left", () => {
		expect(renderTeardown(report(), 0)).toEqual([])
		expect(renderTeardown(report({ removed: 2 }), 2)).toEqual(["  cleaned up 2/2 created record(s)"])
	})

	it("says what was left in place when no teardown ran, never that it was cleaned up", () => {
		expect(renderTeardown(null, 0)).toEqual([])
		expect(renderTeardown(null, 3)).toEqual(["  left 3 created record(s) in place: teardown did not run"])
	})

	it("lists unsupported entities and at most five leftovers", () => {
		const failed = Array.from({ length: 7 }, (_, at) => ({
			entity: "note",
			id: `n${at}`,
			principal: "alpha",
			reason: "403",
		}))
		const lines = renderTeardown(report({ failed, removed: 1, unsupported: ["tag", "pin"] }), 9)
		expect(lines[0]).toBe("  cleanup: removed 1/9 created record(s)")
		expect(lines[1]).toMatch(/^ {4}tag, pin — no delete operation in the document/)
		expect(lines.slice(2)).toEqual([
			"    note n0 (as alpha): 403",
			"    note n1 (as alpha): 403",
			"    note n2 (as alpha): 403",
			"    note n3 (as alpha): 403",
			"    note n4 (as alpha): 403",
			"    … and 2 more",
		])
		expect(renderTeardown(report({ unsupported: ["tag"] }), 1)).toHaveLength(2)
		const one = [{ entity: "note", id: "n1", principal: "alpha", reason: "403" }]
		expect(renderTeardown(report({ failed: one }), 1)).toEqual([
			"  cleanup: removed 0/1 created record(s)",
			"    note n1 (as alpha): 403",
		])
	})

	it("names each inferred record, removed or not", () => {
		const records = [
			{ entity: "note", id: "n1", principal: "alpha", removed: true },
			{ entity: "job", id: "j1", inferred: true as const, principal: "alpha", removed: true },
			{ entity: "job", id: "j2", inferred: true as const, principal: "beta", removed: false },
		]
		expect(renderTeardown(report({ records, removed: 2 }), 3)).toEqual([
			"  cleaned up 2/3 created record(s)",
			"  inferred: 2 record(s) ledgered from an answer that named a new id, not from a declared create",
			"    job j1 (as alpha): removed",
			"    job j2 (as beta): left in place",
		])
	})

	it("lists creates whose record could not be identified, even with nothing else created", () => {
		const unidentified = Array.from({ length: 6 }, (_, at) => create(at + 1))
		const lines = renderTeardown(report({ unidentified }), 0)
		expect(lines[0]).toBe("  leftovers: 6 create(s) answered 2xx but no id could be read; the record may remain")
		expect(lines[1]).toBe("    notes.create POST http://api.test/notes → 201 (#1)")
		expect(lines.at(-1)).toBe("    … and 1 more")
		expect(renderTeardown(report({ unidentified: [create(1)] }), 0)).toHaveLength(2)
	})
})

describe("renderTeardown: what a scenario kept for a later run", () => {
	const kept = { entity: "account", id: "k@x.test", kept: "later-run", principal: "(none)", removed: false }
	const gone = { entity: "account", id: "g@x.test", principal: "account-2", removed: true }

	it("lists each kept account with the scenario that kept it, apart from what was cleaned up", () => {
		expect(renderTeardown(report({ records: [kept, gone], removed: 1 }), 2)).toEqual([
			"  cleaned up 1/2 created record(s), 1 kept for a later run",
			'    account k@x.test kept by scenario "later-run"',
		])
	})

	it("lists them beside leftovers too", () => {
		const failed = [{ entity: "note", id: "n1", principal: "alpha", reason: "403" }]
		expect(renderTeardown(report({ failed, records: [kept], removed: 0 }), 2)).toEqual([
			"  cleanup: removed 0/2 created record(s), 1 kept for a later run",
			"    note n1 (as alpha): 403",
			'    account k@x.test kept by scenario "later-run"',
		])
	})
})
