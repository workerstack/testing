import { mkdirSync, readFileSync, symlinkSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import type { Flags } from "../flags.ts"
import { bufferWriter } from "../writer.ts"
import { folder, json, savedRun } from "../__fixtures__/files.ts"
import { LEGACY_REPORT } from "../legacy-run.ts"
import { commandBaseline } from "./baseline.ts"

/* A run's root-cause findings, written as the baseline the next runs measure against. */

const finding = {
	check: "list.read-after-write",
	detail: "d",
	entity: "note",
	evidence: [],
	summary: "s",
	verdict: "BACKEND_BUG",
}

describe("commandBaseline", () => {
	it("writes a run's findings as known, through the latest link too", async () => {
		const dir = folder()
		const run = savedRun(dir, "2026-10-18T00-00-00Z", { findings: [finding] })
		symlinkSync(run, join(dir, "latest"))
		const out = join(dir, "testing.api.baseline.json")
		const writer = bufferWriter()
		expect(await commandBaseline(writer, { from: join(dir, "latest"), out })).toBe(0)
		expect(writer.text()).toBe(`  1 known finding → ${out}\n`)
		expect(JSON.parse(readFileSync(out, "utf8"))).toMatchObject({
			entries: [expect.objectContaining({ check: "list.read-after-write" })],
		})
		const two = savedRun(dir, "two", { findings: [finding, { ...finding, entity: "tag" }] })
		const again = bufferWriter()
		expect(await commandBaseline(again, { force: true, from: two, out })).toBe(0)
		expect(again.text()).toContain("2 known findings")
	})

	it("writes testing.api.baseline.json in the working folder by default", async () => {
		const dir = folder()
		const cwd = process.cwd()
		process.chdir(dir)
		try {
			expect(await commandBaseline(bufferWriter(), { from: savedRun(dir, "run", { findings: [] }) })).toBe(0)
			expect(readFileSync(join(dir, "testing.api.baseline.json"), "utf8")).toContain('"entries"')
		} finally {
			process.chdir(cwd)
		}
	})

	it("refuses without a run, with an unreadable or listless report, and over an existing file", async () => {
		const dir = folder()
		const refusals: Array<[Flags, RegExp]> = [
			[{}, /^testing api: baseline needs --from/],
			[{ from: join(dir, "missing") }, /^testing api: cannot read .*report\.json: /],
			[{ from: savedRun(dir, "empty", { findings: "none" }) }, /holds no findings list/],
			[
				{ from: savedRun(dir, "ok", { findings: [] }), out: json(dir, "taken.json", "{}") },
				/exists; --force overwrites it/,
			],
		]
		for (const [flags, said] of refusals) {
			const writer = bufferWriter()
			expect(await commandBaseline(writer, flags)).toBe(2)
			expect(writer.text()).toMatch(said)
		}
	})

	it("refuses a report from a newer schema, and reads one from 0.24 or schema 1", async () => {
		const dir = folder()
		const current = savedRun(dir, "current", { findings: [finding], schemaVersion: 1 })
		expect(await commandBaseline(bufferWriter(), { from: current, out: join(dir, "a.json") })).toBe(0)
		const newer = bufferWriter()
		const from = savedRun(dir, "newer", { findings: [finding], schemaVersion: 2 })
		expect(await commandBaseline(newer, { from, out: join(dir, "b.json") })).toBe(2)
		expect(newer.text()).toBe(
			`testing api: ${join(dir, "newer", "report.json")} is report schemaVersion 2; this the API tester reads 1 — upgrade the API tester\n`,
		)
	})
})

/* A run folder written before the package was renamed is not read: the CLI names the move. */
describe("commandBaseline from an old run", () => {
	it("names a run folder from before the rename instead of a missing report", async () => {
		const dir = folder()
		mkdirSync(join(dir, "old"))
		const old = json(join(dir, "old"), LEGACY_REPORT, "{}")
		const writer = bufferWriter()
		expect(await commandBaseline(writer, { from: join(dir, "old") })).toBe(2)
		expect(writer.text()).toBe(
			`testing api: ${join(dir, "old")} is a run from before the rename (it holds ${LEGACY_REPORT}); those are not read. See docs/api/migrating-from-oat.md\n`,
		)
		expect(old).toContain(LEGACY_REPORT)
	})
})
