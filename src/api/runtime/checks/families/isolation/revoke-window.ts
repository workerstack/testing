import { UnsatisfiedSecurity } from "../../../../client/credential-source.ts"
import type { Exchange } from "../../../exchange.ts"
import { ASSERTED, asserted, type Outcome } from "../../../finding.ts"
import { stalenessSchedule, watchCapMs } from "../consistency/staleness-schedule.ts"
import { type Bracket, SYSTEM_CLOCK, type WatchClock, watchUntilFresh } from "../consistency/staleness-watch.ts"
import { type Flow, readGrant } from "./invite-flow.ts"

/*
 * How long a revoked grant keeps working, for an API that declares `x-invite.revokeStaleness`: it
 * authorizes from short-lived tokens it does not invalidate, so a revoke lands when the delegate's
 * token lapses. The delegate reads on `stalenessSchedule` until a read is refused, each read sending
 * the credential it holds then, so a renewal that drops the grant, or is refused, ends the window.
 */

/** The clock the watch keeps; a test swaps it for one that only moves when the watch sleeps. */
export const REVOKE_TIMING: { clock: WatchClock } = { clock: SYSTEM_CLOCK }

/** One read as the delegate: its answer, or why its credential could not be renewed to send it. */
export type Attempt = { exchange: Exchange } | { renewalRefused: string }

const refused = (attempt: Attempt): boolean => "renewalRefused" in attempt || attempt.exchange.status >= 300

async function readAsDelegate(flow: Flow, grantRead: NonNullable<Flow["grantRead"]>): Promise<Attempt> {
	try {
		return { exchange: await readGrant(flow, grantRead) }
	} catch (error) {
		if (error instanceof UnsatisfiedSecurity && error.kind === "blocked") return { renewalRefused: error.reason }
		throw error
	}
}

/** What the watch saw: where the window closed, and why, when a refused renewal closed it. */
export interface RevokeWatch {
	bracket: Bracket<Attempt>
	renewalRefused: string | undefined
}

/** Reads after the revoke until one is refused, or the declared bound (at most the longest watch) has passed. */
export async function watchRevoke(
	flow: Flow,
	{ grantRead, boundS }: { grantRead: NonNullable<Flow["grantRead"]>; boundS: number },
): Promise<RevokeWatch> {
	const capMs = watchCapMs(boundS * 1000)
	let renewalRefused: string | undefined
	const bracket = await watchUntilFresh<Attempt>({
		capMs,
		clock: REVOKE_TIMING.clock,
		fresh: refused,
		read: async () => {
			const answer = await readAsDelegate(flow, grantRead)
			if ("renewalRefused" in answer) renewalRefused = answer.renewalRefused
			return answer
		},
		schedule: stalenessSchedule(capMs),
	})
	return { bracket, renewalRefused }
}

function windowOf({ bracket, renewalRefused }: RevokeWatch): string {
	const why = renewalRefused === undefined ? "" : ` (renewing its credential failed: ${renewalRefused})`
	if (bracket.staleAtMs === null) return `the first read after the revoke was refused${why}`
	if (bracket.freshAtMs === null) return `the revoked grant still read at ${bracket.staleAtMs}ms`
	return `the revoked grant still read at ${bracket.staleAtMs}ms and was refused at ${bracket.freshAtMs}ms${why}`
}

/**
 * Within the declared bound passes, the window reported; still readable at a bound the watch
 * reached is the revoke finding, naming both; a bound past the longest watch is noted, not judged.
 */
export function judgeRevoke(
	flow: Flow,
	judged: { watched: RevokeWatch; boundS: number; evidence: Exchange[] },
): Outcome {
	const { ctx, check, plan, subjectLabel } = flow
	const { boundS, watched } = judged
	const { bracket } = watched
	const window = windowOf(watched)
	const declared = `the declared x-invite.revokeStaleness of ${boundS}s`
	if (bracket.freshAtMs !== null) return asserted(`${window}, within ${declared}`)
	/* Never refused: every read was stale, so the last one went out and answered. */
	if ((bracket.staleAtMs as number) < boundS * 1000) {
		return asserted(`${window}, the longest the API tester watches; ${declared} is not judged past it`)
	}
	const stale = (bracket.stale as { exchange: Exchange }).exchange
	ctx.findings.backend(check, ctx.entityName, {
		summary: "revoking an invite does not remove access",
		detail:
			`${plan.delegate.id} can still read ${subjectLabel} after the grant was revoked: ${window}, past ` +
			`${declared}. A share that cannot be taken back within its bound is a standing leak.`,
		evidence: [...judged.evidence, stale],
	})
	return ASSERTED
}
