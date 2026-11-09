import { describe, expect, it } from "vitest"
import type { OperationObject } from "../types.ts"
import { readInvite } from "./invite.ts"

const op = (invite: unknown) => ({ "x-invite": invite }) as OperationObject
const flow = { accept: "invite.accept", invite: "invite.create", revoke: "invite.revoke" }

describe("x-invite", () => {
	it("reads the three operations with every default", () => {
		expect(readInvite(op(flow))).toEqual({
			...flow,
			credentialFrom: "$.access_token",
			grantPointer: "$.grant_id",
			granteeField: "key",
			tokenFrom: "response",
			tokenPointer: "$.token",
		})
	})

	it("reads every override", () => {
		expect(
			readInvite(
				op({
					...flow,
					acceptFrom: "link",
					credentialFrom: "$.jwt",
					grantPointer: "$.g",
					granteeField: "email",
					grants: "org.get",
					revokeStaleness: 300,
					tokenFrom: "outOfBand",
					tokenKind: "mail",
					tokenPointer: "$.t",
				}),
			),
		).toEqual({
			...flow,
			acceptFrom: "link",
			credentialFrom: "$.jwt",
			grantPointer: "$.g",
			granteeField: "email",
			grants: "org.get",
			revokeStaleness: 300,
			tokenFrom: "outOfBand",
			tokenKind: "mail",
			tokenPointer: "$.t",
		})
	})
})

describe("x-invite without a usable value", () => {
	it("ignores empty or unknown overrides", () => {
		const read = readInvite(
			op({ ...flow, acceptFrom: "token", credentialFrom: "", grants: "", tokenFrom: "mail", tokenKind: "" }),
		)
		expect(read).toEqual(readInvite(op(flow)))
	})

	it("ignores a revoke staleness that is not positive whole seconds", () => {
		for (const revokeStaleness of [0, -5, 1.5, "300s", "300", null]) {
			expect(readInvite(op({ ...flow, revokeStaleness }))).toEqual(readInvite(op(flow)))
		}
	})

	it("is null without all three operations", () => {
		expect(readInvite({} as OperationObject)).toBeNull()
		expect(readInvite(op({ ...flow, invite: 1 }))).toBeNull()
		expect(readInvite(op({ ...flow, accept: undefined }))).toBeNull()
		expect(readInvite(op({ ...flow, revoke: null }))).toBeNull()
		expect(readInvite(op(null))).toBeNull()
	})
})
