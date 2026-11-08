#!/usr/bin/env node
/*
 * The package's executable, `testing`: `bin/testing.js` imports `start` and calls it, since its own
 * argv[1] is the bin wrapper, not this module. Run directly, it starts itself the same way.
 */
import { invokedDirectly } from "./api/cli/main.ts"
import { start } from "./cli/main.ts"

export { start } from "./cli/main.ts"

if (invokedDirectly(process.argv[1], import.meta.url)) await start()
