---
name: vitest-mockrestore-clears-calls
paths: ["**/*.test.ts","**/*.test.tsx","src/web/solid/warnings.ts"]
hits: 1
last-hit: 2026-11-15
evidence: ["roadmap 10"]
---

# vitest's mockRestore clears a spy's recorded calls

## Mistake
ui's hydration helper spied on `console.warn`, restored the spy in `finally`, then read `spy.mock.calls`. In vitest 5 `mockRestore` empties `mock.calls`, so every client warning was dropped and the suite passed over real hydration bugs.

## Fix
Copy what a spy recorded before restoring it. A test of a warning recorder plants a real warning and asserts it comes back, so an empty result can't pass.
