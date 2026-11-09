import { accountOps } from "../accounts/ops.ts"
import type { AccountLedger } from "../accounts/ledger.ts"
import { deletedDuringRun } from "../accounts/watch.ts"
import { externalExcluded } from "../profile.ts"
import type { ScenarioAccounts } from "../scenario/lineage.ts"
import { runScenarios } from "../scenario/run.ts"
import type { RunContext } from "./context.ts"
import { stopped } from "./interrupt.ts"

/** The declared flows for operations the matrix cannot reach, after the matrix's fixtures are gone. */
export async function scenarios(ctx: RunContext): Promise<void> {
	const { progress, ownScenarios, state, client, principals, findings, grades, hooks, scope, model } = ctx
	progress.enter("scenario", `${ownScenarios.length} scenario(s)`)
	await runScenarios({
		accounts: scenarioAccounts(ctx),
		checksRun: state.checksRun,
		client,
		defaultPrincipal: principals.alpha.id,
		findings,
		grades,
		hooks,
		inScope: (operationId) => scope.inScope(operationId),
		mode: scope.mode,
		model,
		originClients: ctx.originClients,
		outOfBand: ctx.options.outOfBand ?? {},
		principals: new Map(principals.all.map((principal) => [principal.id, { scope: principal.scope }])),
		blocked: new Map(principals.blocked.map((principal) => [principal.id, principal.reason])),
		scenarios: ownScenarios,
		skipped: (scenario) => externalExcluded(scenario, ctx.options.externals?.kinds, ctx.profile),
		stopped: () => stopped(ctx),
	})
}

/**
 * The run's ledger as a scenario reaches it: a self delete, when the document has one, settles an
 * entry only while it is owed, and a kept account stays owed until teardown settles it kept.
 */
function scenarioAccounts(ctx: RunContext): ScenarioAccounts {
	const { accounts } = ctx
	const deleteSelf = accountOps(ctx.model).deleteSelf?.operationId
	return {
		...(deleteSelf === undefined ? {} : { deleteSelf }),
		addressedTo: (address) => addressedTo(accounts, address),
		deletedItself: (entry, exchange) => {
			if (!accounts.owed().includes(entry)) return
			/* Only the document's delete-self, which the scenario checked the exchange called, settles one. */
			accounts.settle(entry, {
				note: deletedDuringRun(exchange.operationId as string, exchange.seq),
				status: "removed",
			})
		},
		keepAccount: (entry, scenario) => accounts.keep(entry, scenario),
		madeBy: (exchange) => accounts.madeBy(exchange),
	}
}

/* The one account the run still owes that `address` names; none when none, or two, do. */
function addressedTo(accounts: AccountLedger, address: string) {
	const named = accounts.owed().filter((entry) => Object.values(entry.identity).includes(address))
	return named.length === 1 ? named[0] : undefined
}
