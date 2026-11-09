/**
 * Adopts the credential a create hands its creator for the record it made (`x-entity.credentialFrom`).
 *
 * An API that gives each account one token scoped to one tenant answers a tenant's create with a
 * token for that tenant: the creator's own is refused under it. Every view's request passes through
 * `Client.request`, so this reads each answer there, before the caller sees it, and before the create
 * tracker reads the record back: what the creator sends next under the record (a child's create, a
 * check, teardown's delete) carries the record's credential, and nothing outside it changes.
 */

import { readPath } from "../client/read-path.ts"
import { own } from "../credentials/effective.ts"
import { stringsOf } from "../credentials/read.ts"
import type { RecordScopes } from "../credentials/record-scoped.ts"
import type { CredentialStore } from "../credentials/store.ts"
import type { OperationModel, SpecModel } from "../spec/graph/types.ts"
import { createdIdOf, itemPathOf } from "./created-id.ts"
import type { Exchange } from "./exchange.ts"
import { fillPath } from "./fill-path.ts"
import { isProbeExchange } from "./probe-judging.ts"

/** What the adopter reads answers against, and where it holds what it adopts. */
export interface RecordCredentialInput {
	model: SpecModel
	store: Pick<CredentialStore, "adopt" | "enroll" | "principals">
	records: RecordScopes
	/** A URL's path below the client's base, as a request's route names it. */
	relativePath: (url: string) => string
	/**
	 * A secondary origin's run: its scheme to the primary scheme whose credential it sends (the config's
	 * `origins[].security`), which the store holds credentials under. Undefined, a scheme is its own.
	 */
	mapping: Readonly<Record<string, string>> | undefined
}

/*
 * The record's own path, encoded as a request sends it: the entity's item route filled from the
 * create's own parameters and the id it answered, else the create's path and the id below it.
 */
function recordPathOf(
	input: RecordCredentialInput,
	made: { exchange: Exchange; op: OperationModel; id: string },
): string {
	const { exchange, id, op } = made
	const below = `${input.relativePath(exchange.url).replace(/\/$/, "")}/${encodeURIComponent(id)}`
	const item = itemPathOf(input.model, op.entity)
	const last = item === undefined ? undefined : /\{([^}]+)\}[^{]*$/.exec(item)?.[1]
	if (item === undefined || last === undefined) return below
	try {
		return fillPath(item, { ...exchange.pathParams, [last]: id })
	} catch {
		/* The item route names a parameter the create's path does not give it. */
		return below
	}
}

/* The create and the credential its answer carries, when it declares one and carried one. */
function issued(input: RecordCredentialInput, exchange: Exchange): { op: OperationModel; value: string } | undefined {
	if (exchange.status < 200 || exchange.status >= 300 || isProbeExchange(exchange)) return undefined
	const op = input.model.byOperationId.get(exchange.operationId ?? "")
	if (op?.credentialFrom == null) return undefined
	const value = readPath(exchange.responseBody, op.credentialFrom)
	return typeof value === "string" && value !== "" ? { op, value } : undefined
}

/** Reads every answer for a credential a create declared, and holds it for its creator under the record. */
export function createRecordAdopter(input: RecordCredentialInput): { observe: (exchange: Exchange) => Promise<void> } {
	const observe = async (exchange: Exchange): Promise<void> => {
		const found = issued(input, exchange)
		const { principal } = exchange
		const sent = exchange.schemes?.[0]
		const scheme = sent === undefined || input.mapping === undefined ? sent : own(input.mapping, sent)
		if (found === undefined || principal === undefined || scheme === undefined) return
		const entry = input.store.principals[principal]
		const id = createdIdOf({ createOp: found.op, exchange, model: input.model, sent: exchange.requestBody })
		if (entry === undefined || id === undefined) return
		const holder = input.records.nextHolder(principal)
		input.store.enroll(holder, entry)
		/* What the answer carried beside the credential, a refresh token say, is what its refresh runs from. */
		const scope = stringsOf(exchange.responseBody)
		const held = await input.store.adopt({ principal: holder, scheme, scope, value: found.value })
		if ("blocked" in held) return
		const path = recordPathOf(input, { exchange, id: String(id.value), op: found.op })
		input.records.add({ holder, path, principal, scheme })
	}
	return { observe }
}
