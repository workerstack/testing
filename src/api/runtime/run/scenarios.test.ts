import { describe, expect, it } from "vitest"
import type { ProgressSnapshot } from "../progress/types.ts"
import type { ScenarioStep } from "../../config/types/steps.ts"
import { runVerdict } from "../exit.ts"
import { accountsApi, accountsDoc, accountsState } from "./__fixtures__/accounts.ts"
import { contextOf, EMAIL_LOGIN, notesApi, optionsFor } from "./__fixtures__/api.ts"
import { teardownAccounts } from "./accounts.ts"
import { scenarios } from "./scenarios.ts"

describe("scenarios", () => {
	it("runs this origin's declared flows as the run's principals, naming the stage", async () => {
		const snaps: ProgressSnapshot[] = []
		const options = optionsFor(notesApi(), {
			onProgress: (snap) => snaps.push(snap),
			scenarios: [{ covers: ["notes.list"], id: "list-notes", steps: [{ operationId: "notes.list" }] }] as never,
		})
		const ctx = await contextOf(options)
		await scenarios(ctx)
		expect(snaps.find((snap) => snap.phase === "scenario")?.message).toBe("1 scenario(s)")
		expect(options.seen.at(-1)).toMatchObject({ method: "GET", path: "/notes" })
		expect(ctx.findings.findings).toEqual([])
	})

	it("hands the scenarios the principals BLOCKED at sign-in, so one that needs them is BLOCKED, not run", async () => {
		const options = optionsFor(notesApi(), {
			scenarios: [
				{ covers: ["notes.list"], id: "peer", principal: "alpha", steps: [{ operationId: "notes.list" }] },
			] as never,
		})
		const ctx = await contextOf(options)
		const sent = options.seen.length
		const blocked = [{ id: "alpha", reason: "auth.token answered 401" }]
		await scenarios({ ...ctx, principals: { ...ctx.principals, blocked } })
		expect(options.seen).toHaveLength(sent)
		expect(ctx.findings.findings.map((finding) => [finding.check, finding.verdict])).toEqual([
			["scenario.peer", "BLOCKED"],
		])
	})

	it("leaves out a scenario whose external has a kind the active profile excludes", async () => {
		const options = optionsFor(notesApi(), {
			externals: { kinds: { consent: "device" } },
			profile: "default",
			profiles: { default: { excludeExternalKinds: ["device"] } },
			scenarios: [
				{
					covers: ["notes.list"],
					id: "consent",
					steps: [{ operationId: "notes.list" }, { as: "code", external: "consent" }],
				},
			] as never,
		})
		const ctx = await contextOf(options)
		const sent = options.seen.length
		await scenarios(ctx)
		expect(options.seen).toHaveLength(sent)
		expect(ctx.findings.findings.map((finding) => [finding.check, finding.verdict, finding.detail])).toEqual([
			[
				"profile.skip",
				"COVERAGE_GAP",
				'external "consent" is kind "device", which profile "default" excludes. What it covers stays ungraded under this profile.',
			],
		])
	})
})

describe("scenarios, as whom", () => {
	it("sends a scenario that names no principal as the configured writer, not the first principal", async () => {
		const options = optionsFor(notesApi(), {
			principals: { alpha: { email: "a@x.test" }, beta: { email: "b@x.test" } },
			scenarios: [{ covers: ["notes.list"], id: "list-notes", steps: [{ operationId: "notes.list" }] }] as never,
			security: { bearer: { static: "tok-{principal.email}" } },
			writer: "beta",
		})
		const ctx = await contextOf(options)
		await scenarios(ctx)
		expect(options.seen.at(-1)?.headers["authorization"]).toBe("Bearer tok-b@x.test")
	})
})

describe("scenarios: an account that deletes itself through the scenario's session", () => {
	it("is settled during the run by the ledger, once, not left for teardown", async () => {
		const state = accountsState()
		const ctx = await contextOf(
			optionsFor(accountsApi(state), {
				principals: { alpha: { email: "alpha@x.test" } },
				scenarios: [
					{
						covers: ["me.delete"],
						id: "self-delete",
						steps: [
							{
								anonymous: true,
								body: { email: "s@x.test", password: "pw-123456" },
								operationId: "auth.signup",
								saveAs: { session: "$.access_token" },
							},
							{
								anonymous: true,
								headers: { authorization: "Bearer {session}" },
								operationId: "me.read",
								saveAs: { who: "$.email" },
							},
							{ anonymous: true, headers: { authorization: "Bearer t-{who}" }, operationId: "me.delete" },
							{ anonymous: true, headers: { authorization: "Bearer t-{who}" }, operationId: "me.delete" },
						],
					},
				] as never,
				security: EMAIL_LOGIN,
			}),
		)
		await scenarios(ctx)
		const made = ctx.accounts.entries().filter((entry) => entry.identity["email"] === "s@x.test")
		const [first, again] = ctx.client.transcript.filter((sent) => sent.operationId === "me.delete")
		expect(state.removed).toEqual(["s@x.test", "s@x.test"])
		expect(again?.status).toBe(204)
		expect(made).toHaveLength(1)
		expect(made[0]).toMatchObject({
			note: `deleted itself during the run (me.delete #${first?.seq})`,
			status: "removed",
		})
		expect(ctx.accounts.owed()).not.toContain(made[0])
	})
})

const signUpAs = (email: string): ScenarioStep => ({
	anonymous: true,
	body: { email, password: "pw-123456" },
	operationId: "auth.signup",
	saveAs: { session: "$.access_token" },
})

/** A run whose one scenario runs `steps`, mailing each address its own account's token. */
async function accountScenario(steps: ScenarioStep[], doc = accountsDoc()) {
	const state = accountsState()
	const ctx = await contextOf(
		optionsFor(accountsApi(state, doc), {
			hooks: { resolveOutOfBand: async ({ address }) => `t-${address}` },
			outOfBand: { attempts: 1 },
			principals: { alpha: { email: "alpha@x.test" } },
			scenarios: [{ covers: [], id: "later-run", steps }] as never,
			security: EMAIL_LOGIN,
		}),
	)
	await scenarios(ctx)
	const entryOf = (email: string) => ctx.accounts.entries().find((entry) => entry.identity["email"] === email)
	return { ctx, entryOf, state }
}

const deleteWith = (name: string): ScenarioStep => ({
	anonymous: true,
	headers: { authorization: `Bearer {${name}}` },
	operationId: "me.delete",
})

describe("scenarios: an account a value delivered outside HTTP is addressed to", () => {
	it("is settled by a delete that sends only the mailed value", async () => {
		const mailed: ScenarioStep = { outOfBand: { address: "s@x.test", as: "mailed", kind: "verify" } }
		const { ctx, entryOf } = await accountScenario([signUpAs("s@x.test"), mailed, deleteWith("mailed")])
		const sent = ctx.client.transcript.find((exchange) => exchange.operationId === "me.delete")
		expect(entryOf("s@x.test")).toMatchObject({
			note: `deleted itself during the run (me.delete #${sent?.seq})`,
			status: "removed",
		})
	})

	it("is not, when the mailed value went to an address no account the run made is named by", async () => {
		const mailed: ScenarioStep = { outOfBand: { address: "s@x.test", as: "mailed", kind: "verify" } }
		const stranger: ScenarioStep = { outOfBand: { address: "nobody@x.test", as: "mailed", kind: "verify" } }
		const { entryOf, state } = await accountScenario([signUpAs("s@x.test"), mailed, stranger, deleteWith("mailed")])
		expect(state.removed).toEqual([])
		expect(entryOf("s@x.test")?.status).toBe("created")
	})
})

describe("scenarios: an account a scenario keeps for a later run", () => {
	it("is left in place by teardown, and reported kept by the scenario, not as a leftover", async () => {
		const keeping = { ...signUpAs("k@x.test"), keepAccount: true } as ScenarioStep
		const { ctx, entryOf, state } = await accountScenario([keeping, signUpAs("gone@x.test")])
		await teardownAccounts(ctx)
		expect(entryOf("k@x.test")).toMatchObject({
			kept: "later-run",
			note: 'kept for a later run by scenario "later-run"',
			status: "kept",
		})
		expect(state.removed).toEqual(["gone@x.test"])
		expect(ctx.state.teardown?.failed).toEqual([])
		expect(ctx.state.teardown?.records).toEqual([
			{ entity: "account", id: "k@x.test", kept: "later-run", principal: "(none)", removed: false },
			{ entity: "account", id: "gone@x.test", principal: "account-2", removed: true },
		])
		expect(runVerdict({ findings: [], teardown: ctx.state.teardown }).outcome).toBe("clean")
	})

	it("is kept on a document with no delete-self, where the scenario has nothing else of the ledger", async () => {
		const keeping = { ...signUpAs("k@x.test"), keepAccount: true } as ScenarioStep
		const { ctx, entryOf } = await accountScenario([keeping], accountsDoc({ deleteSelf: false }))
		expect(ctx.findings.findings).toEqual([])
		expect(entryOf("k@x.test")?.kept).toBe("later-run")
	})
})
