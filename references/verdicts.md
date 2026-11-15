---
description: Verdicts and exit codes
order: 40
---

# Verdicts and exit codes

| verdict        | meaning                                                           |
| -------------- | ----------------------------------------------------------------- |
| `BACKEND_BUG`  | the handler is wrong                                              |
| `SPEC_BUG`     | the document is wrong, or disagrees with the handler              |
| `SECURITY`     | an isolation or authorization failure across a declared boundary  |
| `AMBIGUITY`    | the same evidence, where the boundary was only inferred           |
| `COVERAGE_GAP` | a check could not run; the report names the tag that would let it |
| `BLOCKED`      | a check this one depends on already failed                        |

| exit | means                                                                            |
| ---- | -------------------------------------------------------------------------------- |
| `0`  | no defects                                                                       |
| `1`  | a root-cause finding (`BACKEND_BUG`, `SPEC_BUG`, `SECURITY`, `AMBIGUITY`)        |
| `2`  | usage: a missing or wrong flag, or a config the document contradicts             |
| `3`  | The API tester could not do what it was asked (the network never came back, say) |
| `4`  | the run may have left records behind; they are listed under Leftovers            |

Any non-zero exit fails CI. Gaps and blocked checks never fail a full run on their own.
