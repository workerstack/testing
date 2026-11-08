import { existsSync } from "node:fs"
import { join } from "node:path"

/* The report a run folder held before the package was renamed from oat; the API tester reads report.json. */
export const LEGACY_REPORT = "oat-report.json"

/** Why `run` cannot be read when it is a run folder from before the rename, else `undefined`. */
export function legacyRunHint(run: string): string | undefined {
	if (!existsSync(join(run, LEGACY_REPORT))) return undefined
	return `${run} is a run from before the rename (it holds ${LEGACY_REPORT}); those are not read. See docs/api/migrating-from-oat.md`
}
