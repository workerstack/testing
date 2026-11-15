import { spawnSync } from "node:child_process"
import { cpSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

/*
 * `bun run check` covers the shipped labs TypeScript through tsconfig.test.json. The labs configs
 * import the build, "../dist/index.js", as a copy inside the repository must; CI checks before
 * anything is built, so `rootDirs` maps that path onto the source. A build that exists is read
 * first whatever the order, so a local check alone cannot prove the mapping: these checks copy the
 * tree without its build folder, as a fresh clone has none, and run the same `tsc` on the copy.
 */

const ROOT = join(import.meta.dirname, "..", "..")
const TSC = join(ROOT, "node_modules", "typescript", "bin", "tsc")
const COPIED = ["src", "labs", "package.json", "tsconfig.json", "tsconfig.test.json"]

let tree = ""

beforeAll(() => {
	tree = mkdtempSync(join(tmpdir(), "labs-typecheck-"))
	for (const entry of COPIED) cpSync(join(ROOT, entry), join(tree, entry), { recursive: true })
	symlinkSync(join(ROOT, "node_modules"), join(tree, "node_modules"), "dir")
})

afterAll(() => {
	if (tree !== "") rmSync(tree, { force: true, recursive: true })
})

/** Each labs diagnostic, as `file(line): TSxxxx`, from `tsc` over the labs files of a tree with no build. */
function labsErrors(rootDirs: readonly string[]): string[] {
	const config = { compilerOptions: { rootDirs }, extends: "./tsconfig.test.json", include: ["labs/**/*.ts"] }
	writeFileSync(join(tree, "tsconfig.labs.json"), JSON.stringify(config))
	const run = spawnSync(process.execPath, [TSC, "-p", "tsconfig.labs.json", "--pretty", "false"], {
		cwd: tree,
		encoding: "utf8",
	})
	if (run.error !== undefined) throw run.error
	return [...run.stdout.matchAll(/^(labs\/[^(]+)\((\d+),\d+\): error (TS\d+)/gmu)].map(
		([, file, line, code]) => `${file}(${line}): ${code}`,
	)
}

describe("the labs TypeScript", () => {
	it("is part of the test config the check runs, the shipped configs included", () => {
		const run = spawnSync(process.execPath, [TSC, "-p", "tsconfig.test.json", "--listFilesOnly"], {
			cwd: ROOT,
			encoding: "utf8",
		})
		const configs = ["local", "minimal", "testing.api", "oob-auth"].map((name) => `labs/api/${name}.config.ts`)
		const listed = run.stdout.split("\n").map((file) => file.slice(ROOT.length + 1))
		expect(listed).toEqual(expect.arrayContaining([...configs, "labs/api/serve.ts"]))
	})

	it("type-checks against the source when there is no build", { timeout: 120_000 }, () => {
		expect(labsErrors(["src", "dist"])).toEqual([])
	})

	it(
		"would not resolve the build path without rootDirs, so the check above is the mapping's",
		{ timeout: 120_000 },
		() => {
			expect(labsErrors(["src"])).toEqual(
				expect.arrayContaining(["labs/api/local.config.ts(11): TS2307", "labs/api/testing.api.config.ts(7): TS2307"]),
			)
		},
	)
})
