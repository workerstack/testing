import { readFile, realpath } from "node:fs/promises"
import { resolve } from "node:path"
import { messageOf } from "../../errors/message.ts"
import { diffReports, renderDiff, type SavedReport, schemaRefusal } from "../../report/diff.ts"
import { EXIT } from "../../runtime/exit.ts"
import type { RawOf } from "../../config/types/raw.ts"
import type { Args } from "../flags.ts"
import { legacyRunHint } from "../legacy-run.ts"
import type { Writer } from "../writer.ts"

/** `testing api diff <runA> <runB>`: a report on two runs, never a gate. */
export async function commandDiff(
	writer: Writer,
	flags: Args["flags"],
	positionals: readonly string[],
): Promise<number> {
	const [a, b] = positionals
	if (a === undefined || b === undefined) {
		writer.err("testing api: diff needs two run folders: testing api diff <runA> <runB>\n")
		return EXIT.usage
	}
	const reports: SavedReport[] = []
	for (const run of [a, b]) {
		const read = await savedReport(run)
		if (typeof read === "string") {
			writer.err(`testing api: ${read}\n`)
			return EXIT.usage
		}
		reports.push(read)
	}
	const diff = diffReports(...(reports as [SavedReport, SavedReport]))
	writer.out(flags.json === true ? `${JSON.stringify(diff, null, 2)}\n` : renderDiff(diff))
	return 0
}

/** A run's saved report, or why it cannot be read. `latest` is a link: read where it points. */
async function savedReport(run: string): Promise<SavedReport | string> {
	const file = resolve(run, "report.json")
	let saved: RawOf<SavedReport>
	try {
		const folder = await realpath(resolve(run))
		saved = JSON.parse(await readFile(resolve(folder, "report.json"), "utf8")) as typeof saved
	} catch (error) {
		return legacyRunHint(resolve(run)) ?? `cannot read ${file}: ${messageOf(error)}`
	}
	if (!Array.isArray(saved.findings)) return `cannot read ${file}: it holds no findings list`
	return schemaRefusal(saved, file) ?? (saved as SavedReport)
}
