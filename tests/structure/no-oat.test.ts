import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/*
 * The package was oat before it was @workerstack/testing. Every name it had (the bin, the config
 * file, the env prefix, the run folder, the report kind, the spec keys, the data it sends, the
 * identifiers and the prose) moved with it, so an oat token anywhere is a name the rename missed.
 * Only the history and the guide that explains the move may still say it.
 */

const ROOT = join(import.meta.dirname, "..", "..")
const TEXT = /\.(ts|mts|mjs|js|json|jsonc|md|sh|yml|yaml|snap|txt|sql|html)$|(^|\/)\.gitignore$/
const GUIDE = "migrating-from-oat"
const ALLOWED: readonly string[] = [
	"CHANGELOG.md",
	"docs/api/migrating-from-oat.md",
	"src/api/cli/legacy-run.ts",
	"src/api/cli/legacy-run.test.ts",
	"tests/structure/no-oat.test.ts",
]

/** The oat tokens in `text`: the word on its own, a prefix like `oat-` or `OAT_`, or a camel-case part. */
export function oatTokens(text: string): string[] {
	/* A link to the migration guide names it by its path, which is not a name the rename missed. An
	 * escape like `\n` or `\b` in a string or regex literal is a boundary, not a letter, so `"\noat: …"` still counts. */
	const plain = text.replaceAll(GUIDE, "").replace(/\\[bBntr]/g, " ")
	return [...plain.matchAll(/(?<![A-Za-z])(?:oat|OAT|Oat)(?![a-z])|(?<=[a-z])Oat(?![a-z])/g)].map((match) => match[0])
}

describe("no oat", () => {
	it("finds the word, its prefixes and its camel-case parts, and leaves other words alone", () => {
		const text = "oat run, OAT_TOKEN, oat-report.md, x-oat-defs, OatConfig, runOat, oat's"
		expect(oatTokens(text)).toHaveLength(7)
		expect(oatTokens("Croatian float boat coat goat throat moat oats")).toEqual([])
		expect(oatTokens("see docs/api/migrating-from-oat.md")).toEqual([])
		expect(oatTokens(String.raw`"\noat: stopping", /\n\noat — help/ and /\boat-x/`)).toEqual(["oat", "oat", "oat"])
	})

	it("leaves no oat token in a tracked file outside the history and the migration guide", () => {
		const files = execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" })
			.split("\n")
			.filter((file) => TEXT.test(file) && !ALLOWED.includes(file))
		const hits = files.flatMap((file) => {
			const count = oatTokens(readFileSync(join(ROOT, file), "utf8")).length
			return count === 0 ? [] : [`${file}: ${count}`]
		})
		expect(hits).toEqual([])
	})
})
