import { describe, expect, it, vi } from "vitest"
import { bufferWriter } from "../api/cli/writer.ts"
import { EXIT } from "../api/runtime/exit.ts"
import { main, start } from "./main.ts"

/*
 * `testing` is the package's one command line: its first word names a subpath, and the rest is that
 * subpath's own command line. `api` is the only subpath today.
 */

describe("testing", () => {
	it("prints the subpaths for nothing, help and --help", async () => {
		for (const argv of [[], ["help"], ["--help"]]) {
			const writer = bufferWriter()
			expect(await main(argv, { writer })).toBe(argv.length === 0 ? EXIT.usage : 0)
			expect(writer.text()).toMatch(/^usage: testing <subpath> <command> \[flags\]\n {2}api {4}test a live HTTP API/)
		}
	})

	it("hands everything after api to the api command line", async () => {
		const writer = bufferWriter()
		expect(await main(["api", "help"], { writer })).toBe(0)
		expect(writer.text()).toContain("testing api run")
		const refused = bufferWriter()
		expect(await main(["api", "frobnicate"], { writer: refused })).toBe(EXIT.usage)
		expect(refused.text()).toMatch(/^testing api: unknown command "frobnicate"/)
	})

	it("runs as the process: argv after the script, its exit code the process's", async () => {
		const argv = process.argv
		const code = process.exitCode
		try {
			process.argv = ["node", "testing", "web"]
			const writer = bufferWriter()
			await start({ writer })
			expect(process.exitCode).toBe(EXIT.usage)
			expect(writer.text()).toMatch(/^testing: unknown subpath "web"/)
			/* With no writer given, it writes to the process's own stderr. */
			const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true)
			await start()
			expect(String(stderr.mock.calls[0]?.[0])).toMatch(/^testing: unknown subpath "web"/)
			stderr.mockRestore()
		} finally {
			process.argv = argv
			process.exitCode = code
		}
	})

	it("refuses a subpath it does not have, naming the ones it has", async () => {
		const writer = bufferWriter()
		expect(await main(["web"], { writer })).toBe(EXIT.usage)
		expect(writer.text()).toMatch(/^testing: unknown subpath "web"; the subpaths are: api\n/)
	})
})
