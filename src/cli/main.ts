import { type CliDeps, main as apiMain, start as startCli } from "../api/cli/main.ts"
import { processWriter } from "../api/cli/writer.ts"
import { EXIT } from "../api/runtime/exit.ts"

/* The package's command line: the first word names a subpath, and the rest is that subpath's own. */

type Subpath = { summary: string; main: (argv: readonly string[], deps: CliDeps) => Promise<number> }

/** Every subpath with a command line, by name. */
const SUBPATHS: Readonly<Record<string, Subpath>> = {
	api: { main: apiMain, summary: "test a live HTTP API against its OpenAPI document (testing api help)" },
}

/** The help: one line per subpath, made from the table above. */
export const USAGE: string = /* @__PURE__ */ usage()

function usage(): string {
	const width = Math.max(...Object.keys(SUBPATHS).map((name) => name.length)) + 4
	const lines = Object.entries(SUBPATHS).map(([name, subpath]) => `  ${name.padEnd(width)}${subpath.summary}`)
	return `usage: testing <subpath> <command> [flags]\n${lines.join("\n")}\n`
}

/** `testing <subpath> …`: hands the rest to that subpath's command line. Returns the exit code. */
export async function main(argv: readonly string[], deps: CliDeps): Promise<number> {
	const [first, ...rest] = argv
	if (first === undefined) {
		deps.writer.err(USAGE)
		return EXIT.usage
	}
	if (first === "help" || first === "--help") {
		deps.writer.out(USAGE)
		return 0
	}
	const subpath = SUBPATHS[first]
	if (subpath === undefined) {
		const names = Object.keys(SUBPATHS).join(", ")
		deps.writer.err(`testing: unknown subpath "${first}"; the subpaths are: ${names}\n\n${USAGE}`)
		return EXIT.usage
	}
	return subpath.main(rest, deps)
}

/** Runs `testing` as the process. */
export function start(deps: CliDeps = { writer: processWriter }): Promise<void> {
	return startCli(deps, main)
}
