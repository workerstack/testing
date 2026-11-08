import { mkdirSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { RUN_A, RUN_B } from "../../report/__fixtures__/runs.ts"
import { parseArgs } from "../flags.ts"
import { main } from "../main.ts"
import { bufferWriter } from "../writer.ts"
import { folder, json, savedRun } from "../__fixtures__/files.ts"
import { commandDiff } from "./diff.ts"
import { LEGACY_REPORT } from "../legacy-run.ts"

/* Two runs side by side: new, fixed and persisting findings. A report, never a gate. */

const finding = (entity: string) => ({
	check: "c",
	detail: "d",
	entity,
	evidence: [],
	summary: "s",
	verdict: "BACKEND_BUG",
})

describe("commandDiff", () => {
	it("compares two runs, as text or JSON", async () => {
		const dir = folder()
		const before = savedRun(dir, "a", { findings: [finding("note")] })
		const after = savedRun(dir, "b", { findings: [finding("tag")] })
		const text = bufferWriter()
		expect(await commandDiff(text, {}, [before, after])).toBe(0)
		expect(text.text().length).toBeGreaterThan(0)
		const machine = bufferWriter()
		expect(await commandDiff(machine, { json: true }, [before, after])).toBe(0)
		expect(JSON.parse(machine.text())).toBeTypeOf("object")
	})

	it("refuses without two runs, and names a run it cannot read", async () => {
		const dir = folder()
		const ok = savedRun(dir, "ok", { findings: [] })
		const lacking = bufferWriter()
		expect(await commandDiff(lacking, {}, [ok])).toBe(2)
		expect(lacking.text()).toBe("testing api: diff needs two run folders: testing api diff <runA> <runB>\n")
		const listless = bufferWriter()
		expect(await commandDiff(listless, {}, [ok, savedRun(dir, "bad", { findings: 1 })])).toBe(2)
		expect(listless.text()).toMatch(/bad\/report\.json: it holds no findings list\n$/)
		const missing = bufferWriter()
		expect(await commandDiff(missing, {}, [join(dir, "gone"), ok])).toBe(2)
		expect(missing.text()).toMatch(/^testing api: cannot read .*gone\/report\.json: /)
	})

	it("names a run folder from before the rename instead of a missing report", async () => {
		const dir = folder()
		const ok = savedRun(dir, "ok", { findings: [] })
		mkdirSync(join(dir, "old"))
		json(join(dir, "old"), LEGACY_REPORT, "{}")
		const writer = bufferWriter()
		expect(await commandDiff(writer, {}, [join(dir, "old"), ok])).toBe(2)
		expect(writer.text()).toContain(`${join(dir, "old")} is a run from before the rename`)
	})

	it("refuses a report from a newer schema, and reads one from 0.24 or schema 1", async () => {
		const dir = folder()
		const old = savedRun(dir, "old", { findings: [] })
		const current = savedRun(dir, "current", { findings: [], schemaVersion: 1 })
		expect(await commandDiff(bufferWriter(), {}, [old, current])).toBe(0)
		const newer = bufferWriter()
		expect(await commandDiff(newer, {}, [current, savedRun(dir, "newer", { findings: [], schemaVersion: 2 })])).toBe(2)
		expect(newer.text()).toBe(
			`testing api: ${join(dir, "newer", "report.json")} is report schemaVersion 2; this the API tester reads 1 — upgrade the API tester\n`,
		)
	})
})

/* The command line's way in: two folders as positionals, a report that exits 0 unless it cannot read them. */
describe("testing api diff", () => {
	it("takes two run folders as positionals", () => {
		expect(parseArgs(["diff", "a", "b", "--json"]).positionals).toEqual(["a", "b"])
		expect(parseArgs(["run", "--config", "x.json"]).positionals).toBeUndefined()
	})

	it("prints the comparison, as text or JSON, and exits 0", async () => {
		const dir = folder()
		const runs = [savedRun(dir, "a", RUN_A), savedRun(dir, "b", RUN_B)]
		const text = bufferWriter()
		expect(await main(["diff", ...runs], { writer: text })).toBe(0)
		expect(text.text()).toContain("1 new")
		expect(text.text()).toContain("filter.unknown-field-rejected")
		expect(text.text()).toContain("1.0.88 → 1.0.89")
		const machine = bufferWriter()
		expect(await main(["diff", ...runs, "--json"], { writer: machine })).toBe(0)
		expect(JSON.parse(machine.text()).new).toHaveLength(1)
	})

	it("exits 2 when it cannot read a run", async () => {
		const missing = join(folder(), "gone")
		expect(await main(["diff", join(missing, "a"), join(missing, "b")], { writer: bufferWriter() })).toBe(2)
		expect(await main(["diff", join(missing, "a")], { writer: bufferWriter() })).toBe(2)
	})
})
