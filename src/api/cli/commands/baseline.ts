import { existsSync } from "node:fs"
import { readFile, realpath, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { messageOf } from "../../errors/message.ts"
import { type SavedReport, schemaRefusal } from "../../report/diff.ts"
import { baselineFrom } from "../../runtime/baseline.ts"
import { EXIT } from "../../runtime/exit.ts"
import type { RawOf } from "../../config/types/raw.ts"
import { type Args, str } from "../flags.ts"
import { legacyRunHint } from "../legacy-run.ts"
import type { Writer } from "../writer.ts"

/** `testing api baseline --from <run>`: the run's root-cause findings, as a baseline file. */
export async function commandBaseline(writer: Writer, flags: Args["flags"]): Promise<number> {
	const from = str(flags, "from")
	if (from === undefined) {
		writer.err("testing api: baseline needs --from <run folder | latest>\n")
		return EXIT.usage
	}
	const out = resolve(str(flags, "out") ?? "testing.api.baseline.json")
	let saved: RawOf<SavedReport>
	try {
		/* `latest` is a link: read where it points. */
		const folder = await realpath(resolve(from))
		saved = JSON.parse(await readFile(resolve(folder, "report.json"), "utf8")) as typeof saved
	} catch (error) {
		writer.err(
			`testing api: ${legacyRunHint(resolve(from)) ?? `cannot read ${resolve(from, "report.json")}: ${messageOf(error)}`}\n`,
		)
		return EXIT.usage
	}
	if (!Array.isArray(saved.findings)) {
		writer.err(`testing api: ${resolve(from, "report.json")} holds no findings list\n`)
		return EXIT.usage
	}
	const refusal = schemaRefusal(saved, resolve(from, "report.json"))
	if (refusal !== undefined) {
		writer.err(`testing api: ${refusal}\n`)
		return EXIT.usage
	}
	if (flags.force !== true && existsSync(out)) {
		writer.err(`testing api: ${out} exists; --force overwrites it\n`)
		return EXIT.usage
	}
	const baseline = baselineFrom(saved.findings as Parameters<typeof baselineFrom>[0])
	await writeFile(out, `${JSON.stringify(baseline, null, "\t")}\n`)
	writer.out(`  ${baseline.entries.length} known finding${baseline.entries.length === 1 ? "" : "s"} → ${out}\n`)
	return 0
}
