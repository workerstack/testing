#!/usr/bin/env node
/*
 * The executable. `node dist/api/cli.js …` is how CI, the labs and the tests run the API tester; `bin/testing.js`
 * imports `start` and calls it itself, since its own argv[1] is the bin wrapper, not this module.
 */
import { invokedDirectly, start } from "./cli/main.ts"

export { start } from "./cli/main.ts"

if (invokedDirectly(process.argv[1], import.meta.url)) await start()
