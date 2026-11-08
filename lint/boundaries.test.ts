import { describe, expect, it } from "vitest"
import { rule } from "./boundaries.ts"
import { oxlintReports, reportsOf } from "./rule-harness.ts"

const MESSAGE = "import is outside oat's module boundaries (see AGENTS.md: dependency arrows)"

/* One importing file per case: `from` imports `spec`, and the rule says whether that is allowed. */
function verdict(from: string, spec: string): boolean {
	return reportsOf(rule, { [from]: `import { x } from "${spec}"\n` }).length === 0
}

/* Down the layers, and within a layer's own group. */
const ALLOWED: Array<[string, string]> = [
	["src/api/cli.ts", "./conformance/matrix/cases.ts"],
	["src/api/cli/commands/run.ts", "../../report/render.ts"],
	["src/api/cli.ts", "./runtime/run/index.ts"],
	["src/api/index.ts", "./report/render.ts"],
	["src/api/config/define/define-config.ts", "../../runtime/run/index.ts"],
	["src/api/report/render.ts", "../runtime/run/index.ts"],
	["src/api/conformance/matrix/cases.ts", "../../reference/http/engines.ts"],
	["src/api/conformance/suites/render.ts", "../../report/render.ts"],
	["src/api/runtime/run/pipeline.ts", "../checks/registry.ts"],
	["src/api/runtime/run/stages/load.ts", "../../checks/registry.ts"],
	["src/api/runtime/checks.ts", "../client/request.ts"],
	["src/api/client/request.ts", "../credentials/store.ts"],
	["src/api/runtime/world.ts", "../client/client.ts"],
	["src/api/client/client.ts", "../runtime/cookies/jar.ts"],
	/* The transport directories still under runtime/ are client code, and import as client code. */
	["src/api/runtime/transcript/spool.ts", "../exchange.ts"],
	["src/api/runtime/rate-limit/rules.ts", "../../spec/graph/types.ts"],
	["src/api/runtime/body/encode.ts", "../network/fetch.ts"],
	["src/api/security/redact.ts", "./credential-names.ts"],
	["src/api/security/strip.ts", "../errors/network.ts"],
	["src/api/runtime/world.ts", "../spec/graph.ts"],
	["src/api/spec/graph.ts", "../security/redact.ts"],
	["src/api/spec/graph.ts", "../errors/usage-error.ts"],
	["src/api/spec/graph.ts", "../config/types/principals.ts"],
	["src/api/reference/http/router.ts", "../../spec/types.ts"],
	["src/api/reference/http/router.ts", "../query.ts"],
	["src/api/errors/network.ts", "./usage-error.ts"],
	["src/api/spec/load.ts", "node:fs"],
	["src/api/spec/schema.ts", "ajv/dist/2020.js"],
	["src/api/spec/load.ts", "yaml"],
	["src/api/reference/stores/postgres.ts", "postgres"],
	["src/api/conformance/matrix/engines.ts", "postgres"],
	["src/api/cli.ts", "@lovrozagar/oat"],
	/* The step builders sit just above the step types they emit. */
	["src/api/steps/request.ts", "../config/types/steps.ts"],
	["src/api/steps/view.ts", "./request.ts"],
	["src/api/steps/view.ts", "../errors/usage-error.ts"],
]

/* Against the arrows. */
const REFUSED: Array<[string, string]> = [
	["src/api/spec/graph.ts", "../runtime/world.ts"],
	["src/api/errors/network.ts", "../spec/graph.ts"],
	["src/api/config/types/principals.ts", "../define/define-config.ts"],
	["src/api/reference/http/router.ts", "../../client/client.ts"],
	["src/api/runtime/world.ts", "../reference/http/engines.ts"],
	["src/api/runtime/run/pipeline.ts", "../../reference/http/engines.ts"],
	["src/api/runtime/checks.ts", "../report/render.ts"],
	["src/api/runtime/run/pipeline.ts", "../../conformance/matrix/cases.ts"],
	["src/api/report/render.ts", "../cli.ts"],
	["src/api/report/render.ts", "../config/define/define-config.ts"],
	["src/api/runtime/checks.ts", "./run/index.ts"],
	["src/api/spec/load.ts", "fs"],
	["src/api/client/client.ts", "postgres"],
	["src/api/client/client.ts", "lodash"],
	["src/api/misc/thing.ts", "../spec/graph.ts"],
	["src/api/runtime/world.ts", "../misc/thing.ts"],
	/* security is a leaf: it reaches only the errors and config types. */
	["src/api/security/redact.ts", "../spec/graph.ts"],
	["src/api/security/redact.ts", "../runtime/world.ts"],
	/* client and credentials sit below the runtime: never the reverse arrow. */
	["src/api/credentials/store.ts", "../runtime/body/encode.ts"],
	["src/api/runtime/network/fetch.ts", "../world.ts"],
	["src/api/runtime/exchanges/journal.ts", "../body/encode.ts"],
	["src/api/client/request.ts", "../runtime/checks.ts"],
	["src/api/client/client.ts", "../runtime/checks/registry.ts"],
	["src/api/client/client.ts", "../runtime/world.ts"],
	/* The step builders reach only the step types and the errors: nothing that runs a step. */
	["src/api/steps/request.ts", "../runtime/world.ts"],
	["src/api/steps/request.ts", "../spec/graph.ts"],
	["src/api/steps/request.ts", "../security/redact.ts"],
]

describe("oat/boundaries", () => {
	it("allows the arrows: down the layers, and within a layer's own group", () => {
		expect(ALLOWED.filter(([from, spec]) => !verdict(from, spec))).toEqual([])
	})

	it("refuses an import against the arrows", () => {
		expect(REFUSED.filter(([from, spec]) => verdict(from, spec))).toEqual([])
	})

	it("checks every import form: type imports, re-exports and literal dynamic imports", () => {
		const fixture = {
			"src/api/spec/graph.ts": [
				'import type { A } from "../runtime/world.ts"',
				'export { b } from "../runtime/world.ts"',
				'export * from "../runtime/world.ts"',
				'export const c = () => import("../runtime/world.ts")',
				"export const d = (name: string) => import(name)",
				"export const e = 1",
			].join("\n"),
		}
		const reports = reportsOf(rule, fixture)
		expect(reports.map(({ line }) => line)).toEqual([1, 2, 3, 4])
		expect(reports[0]?.message).toBe(MESSAGE)
	})

	it("leaves tests, fixtures and code outside src alone", () => {
		const source = 'import { x } from "../runtime/world.ts"\nimport { y } from "lodash"\n'
		const fixture = {
			"src/api/spec/graph.test.ts": source,
			"src/api/spec/__fixtures__/a.ts": source,
			"tests/api/integration/a.test.ts": source,
			"lint/a.ts": source,
			"labs/api/demo.ts": source,
		}
		expect(reportsOf(rule, fixture)).toEqual([])
	})

	it("fails oxlint through the oat plugin entry", () => {
		const fixture = { "src/api/spec/graph.ts": 'import { x } from "../runtime/world.ts"\n' }
		expect(oxlintReports("boundaries", fixture).length).toBe(1)
	})
})
