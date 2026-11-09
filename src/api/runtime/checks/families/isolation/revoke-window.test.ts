import { afterEach, describe, expect, it } from "vitest"
import { UnsatisfiedSecurity } from "../../../../client/credential-source.ts"
import type { Answer, Responder } from "../../__fixtures__/harness.ts"
import { runCheck } from "../../core/run.ts"
import { SYSTEM_CLOCK } from "../consistency/staleness-watch.ts"
import { inviteGrantsThenRevokes } from "./auth-invite-grants-then-revokes.ts"
import { inviteBackend, inviteContext, inviteDocument } from "./__fixtures__/invites.ts"
import { REVOKE_TIMING } from "./revoke-window.ts"

/*
 * An API that does not invalidate the tokens it issued declares how long a revoked grant may keep
 * working. The delegate reads on a backoff until it is refused: within the bound passes, past it is
 * the revoke finding, and a bound past the longest watch is noted, not judged.
 */

afterEach(() => {
	REVOKE_TIMING.clock = SYSTEM_CLOCK
})

const DECLARED = "the declared x-invite.revokeStaleness"

/**
 * The invite backend, whose delegate keeps reading for `lagMs` of the watch's clock after the
 * revoke, then meets `after` (the backend's own refusal by default).
 */
function lagging(lagMs: number, after?: () => Answer) {
	let now = 0
	REVOKE_TIMING.clock = {
		now: () => now,
		sleep: async (ms) => {
			now += ms
		},
	}
	const backend = inviteBackend()
	let revokedAt: number | undefined
	const respond: Responder = (method, path, options) => {
		if (method === "DELETE") revokedAt = now
		if (method !== "GET" || revokedAt === undefined) return backend(method, path, options)
		if (now - revokedAt < lagMs) return { body: { id: "n1" }, status: 200 }
		return after?.() ?? backend(method, path, options)
	}
	return respond
}

/** The client's refusal to send: the delegate's renewal was refused, or it holds no credential at all. */
const renewalRefused = (): Answer => {
	throw new UnsatisfiedSecurity("blocked", "the refresh answered 401")
}
const unsatisfied = (): Answer => {
	throw new UnsatisfiedSecurity("unsatisfied", "no credential for bearer")
}

const declaring = (revokeStaleness: unknown) => inviteDocument({ tag: { revokeStaleness } })

const readsAfterRevoke = (sent: readonly { method: string }[]) =>
	sent.slice(sent.findIndex((s) => s.method === "DELETE") + 1).length

describe("auth.invite-grants-then-revokes under a declared revoke staleness", () => {
	it("passes a revoke that lands within the bound, and reports the window", async () => {
		const { ctx, findings, sent } = inviteContext(declaring(300), lagging(1000))
		expect(await runCheck(inviteGrantsThenRevokes, ctx)).toEqual({
			kind: "asserted",
			note: `the revoked grant still read at 750ms and was refused at 1750ms, within ${DECLARED} of 300s`,
		})
		expect(readsAfterRevoke(sent)).toBe(4)
		expect(findings.findings).toEqual([])
	})

	it("reads once when the first read after the revoke is refused", async () => {
		const { ctx, sent } = inviteContext(declaring(300), lagging(0))
		expect(await runCheck(inviteGrantsThenRevokes, ctx)).toEqual({
			kind: "asserted",
			note: `the first read after the revoke was refused, within ${DECLARED} of 300s`,
		})
		expect(readsAfterRevoke(sent)).toBe(1)
	})

	it("ends the window when renewing the delegate's credential is refused", async () => {
		const { ctx } = inviteContext(declaring(300), lagging(1000, renewalRefused))
		expect(await runCheck(inviteGrantsThenRevokes, ctx)).toEqual({
			kind: "asserted",
			note:
				"the revoked grant still read at 750ms and was refused at 1750ms " +
				`(renewing its credential failed: the refresh answered 401), within ${DECLARED} of 300s`,
		})
	})

	it("names the bound and the window when access outlives it", async () => {
		const { ctx, findings, sent } = inviteContext(declaring(5), lagging(Number.POSITIVE_INFINITY))
		expect(await runCheck(inviteGrantsThenRevokes, ctx)).toEqual({ kind: "asserted" })
		expect(findings.findings[0]?.summary).toBe("revoking an invite does not remove access")
		expect(findings.findings[0]?.detail).toBe(
			"delegate can still read note n1 after the grant was revoked: the revoked grant still read at 5500ms, " +
				`past ${DECLARED} of 5s. A share that cannot be taken back within its bound is a standing leak.`,
		)
		expect(findings.findings[0]?.evidence.map((e) => e.status)).toEqual([201, 200, 204, 200])
		expect(readsAfterRevoke(sent)).toBe(7)
	})

	it("notes a bound past the longest watch without judging it", async () => {
		const { ctx, findings } = inviteContext(declaring(900), lagging(Number.POSITIVE_INFINITY))
		expect(await runCheck(inviteGrantsThenRevokes, ctx)).toEqual({
			kind: "asserted",
			note:
				"the revoked grant still read at 600000ms, the longest the API tester watches; " +
				`${DECLARED} of 900s is not judged past it`,
		})
		expect(findings.findings).toEqual([])
	})
})

describe("auth.invite-grants-then-revokes waits only when a bound is declared", () => {
	it("judges the first read after the revoke without one", async () => {
		const { ctx, findings, sent } = inviteContext(inviteDocument(), lagging(1000))
		expect(await runCheck(inviteGrantsThenRevokes, ctx)).toEqual({ kind: "asserted" })
		expect(findings.findings[0]?.detail).toContain("A share that cannot be taken back is a standing leak.")
		expect(readsAfterRevoke(sent)).toBe(1)
	})

	it("sends no read after the revoke when the grant opens none to try", async () => {
		const doc = inviteDocument({
			invitePath: "/orgs/{org_id}/invites",
			revokePath: "/orgs/{org_id}/invites/{grant_id}",
			tag: { revokeStaleness: 300 },
		})
		const { ctx, sent } = inviteContext(doc, lagging(1000), { readOp: undefined })
		expect(await runCheck(inviteGrantsThenRevokes, ctx)).toEqual({ kind: "asserted" })
		expect(sent.at(-1)?.method).toBe("DELETE")
	})

	it("lets a read that fails for another reason fail the check", async () => {
		const { ctx } = inviteContext(declaring(300), lagging(0, unsatisfied))
		await expect(runCheck(inviteGrantsThenRevokes, ctx)).rejects.toThrow("no credential for bearer")
	})
})
