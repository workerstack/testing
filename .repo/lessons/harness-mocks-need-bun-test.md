---
name: harness-mocks-need-bun-test
paths: ["**/*.test.ts"]
hits: 1
last-hit: 2026-11-03
evidence: ["plan 33"]
---

# A harness's module mocks only hold under bun test

## Mistake
A parity harness mocked `node:child_process` with bun's `mock.module` and ran under plain bun. The mock did not apply, and the ops script started two real prod workflows.

## Fix
Run a `mock.module` harness with `bun test`, never plain `bun`. Assert the mock took before calling the code. Start it with `env -i`, a scratch HOME and a PATH holding only the runtime, so a missed mock fails on a missing binary, not on prod.
