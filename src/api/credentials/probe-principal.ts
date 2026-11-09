/*
 * The principal a dedicated credential is held under: `<owner>#probe-<n>`. The store enrolls it so
 * the credential is never the owner's own session; nothing else ever sees it. An exchange, a finding
 * or a teardown record names the owner instead, so no file a run writes carries a probe's id. A
 * credential a create handed its creator for the record it made is held the same way, under
 * `<owner>#record-<n>`, and named by its owner too.
 */

const SUFFIX = /#probe-\d+$/
const HELD_FOR = /#(?:probe|record)-\d+$/
const HELD_FOR_IN_TEXT = /#(?:probe|record)-\d+/g

/** The `n`th probe principal of `owner`. */
export function probePrincipal(owner: string, n: number): string {
	return `${owner}#probe-${n}`
}

/** The `n`th principal `owner`'s record-scoped credentials are held under. */
export function recordHolder(owner: string, n: number): string {
	return `${owner}#record-${n}`
}

/** Whether `principal` holds a credential a create handed its owner for a record. */
export function isRecordHolder(principal: string): boolean {
	return /#record-\d+$/.test(principal)
}

/** The principal a probe principal or a record holder was made for; any other principal is its own. */
export function probeOwner(principal: string): string {
	return principal.replace(HELD_FOR, "")
}

/** `text` with every probe principal and record holder named by its owner: what a reason a report carries must say. */
export function withoutProbes(text: string): string {
	return text.replaceAll(HELD_FOR_IN_TEXT, "")
}

/** Whether `principal` is a dedicated credential's probe principal. */
export function isProbePrincipal(principal: string): boolean {
	return SUFFIX.test(principal)
}
