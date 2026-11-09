/*
 * Credentials a create handed its creator for the record it made (`x-entity.credentialFrom`): an
 * API that scopes each token to one tenant answers a tenant's create with a token for that tenant.
 * Each is held in the store under a principal of its own, `<creator>#record-<n>` (`recordHolder`), so the creator's
 * own credential stays what it sends everywhere else; a request the creator sends at the record's
 * path, or under it, sends the record's instead. Nothing a run writes names the holder: the
 * exchange still names the creator.
 */

import { recordHolder } from "./probe-principal.ts"

/** A credential held for the requests one principal sends under one record. */
export interface RecordCredential {
	/** Who created the record: only its requests send this credential. */
	principal: string
	/** The scheme the create was sent with: the only one this credential replaces. */
	scheme: string
	/** The record's own path below the base, encoded as a request sends it, with no trailing slash. */
	path: string
	/** The principal the store holds the credential under. */
	holder: string
}

/** The record-scoped credentials of one run. */
export interface RecordScopes {
	/** Holds `credential` for its record; a later one for the same record and scheme replaces it. */
	add(credential: RecordCredential): void
	/**
	 * Who holds what `principal` sends for `scheme` on `route` (`<METHOD> <path>`): the holder of the
	 * innermost record whose path the route is at or under, else nobody.
	 */
	holderFor(principal: string, scheme: string, route: string): string | undefined
	/** A fresh holder id for a credential `principal` was handed. */
	nextHolder(principal: string): string
}

/* A route's path: what follows its method. */
function pathOf(route: string): string {
	return route.slice(route.indexOf(" ") + 1)
}

function covers(record: string, path: string): boolean {
	return path === record || path.startsWith(`${record}/`)
}

export function createRecordScopes(): RecordScopes {
	const held: RecordCredential[] = []
	let issued = 0
	return {
		add: (credential) => {
			const same = held.findIndex(
				(other) =>
					other.principal === credential.principal &&
					other.scheme === credential.scheme &&
					other.path === credential.path,
			)
			if (same === -1) held.push(credential)
			else held[same] = credential
		},
		holderFor: (principal, scheme, route) => {
			const path = pathOf(route)
			let innermost: RecordCredential | undefined
			for (const credential of held) {
				if (credential.principal !== principal || credential.scheme !== scheme) continue
				if (!covers(credential.path, path)) continue
				if (innermost === undefined || credential.path.length > innermost.path.length) innermost = credential
			}
			return innermost?.holder
		},
		nextHolder: (principal) => {
			issued += 1
			return recordHolder(principal, issued)
		},
	}
}
