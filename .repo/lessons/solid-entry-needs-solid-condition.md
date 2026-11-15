---
name: solid-entry-needs-solid-condition
paths: ["package.json","src/web/solid/**","tests/web/solid-consumer/**"]
hits: 1
last-hit: 2026-11-15
evidence: ["roadmap 10"]
---

# A Solid entry needs a `solid` condition, or node tests get two Solids

## Mistake
`./web/solid` had no `solid` condition, so Solid's vite plugin left it external in an app's node server tests and it loaded its own `@solidjs/web`. `renderServer` threw "createUniqueId cannot be used outside of a reactive context". The consumer test ran only hydration.

## Fix
Every export whose code imports `solid-js` or `@solidjs/web` carries `"solid"` next to `default`. The packed consumer lists the package in its `package.json` and runs a node server project as well as the browser one.
