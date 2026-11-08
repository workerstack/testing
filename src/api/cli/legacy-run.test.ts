import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { LEGACY_REPORT, legacyRunHint } from "./legacy-run.ts"

/*
 * A run folder written before the rename holds oat-report.json, which the API tester no longer reads.
 * Pointed at one, the CLI names the move instead of reporting a missing report.json.
 */

function folder(files: readonly string[]): string {
	const dir = mkdtempSync(join(tmpdir(), "testing-legacy-run-"))
	mkdirSync(dir, { recursive: true })
	for (const file of files) writeFileSync(join(dir, file), "{}")
	return dir
}

describe("legacyRunHint", () => {
	it("names a run from before the rename and where to read about it", () => {
		const dir = folder([LEGACY_REPORT])
		expect(LEGACY_REPORT).toBe("oat-report.json")
		expect(legacyRunHint(dir)).toBe(
			`${dir} is a run from before the rename (it holds oat-report.json); those are not read. See docs/api/migrating-from-oat.md`,
		)
	})

	it("says nothing about a current run or a folder that is not a run", () => {
		expect(legacyRunHint(folder(["report.json"]))).toBeUndefined()
		expect(legacyRunHint(folder([]))).toBeUndefined()
		expect(legacyRunHint(join(tmpdir(), "testing-no-such-run"))).toBeUndefined()
	})
})
