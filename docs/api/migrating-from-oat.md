# testing api — Migrating from oat

[← back to the overview](../../README.md)

`@lovrozagar/oat` 0.31 became `@workerstack/testing` 0.32, and oat itself became its `/api` subpath:
the API tester. The checks, the config shape and the reports are the same; every name changed. This page
lists each one, old to new. Nothing reads the old names, so change all of them at once.

## Install and run

| oat 0.31                                  | @workerstack/testing 0.32                        |
| ----------------------------------------- | ------------------------------------------------ |
| `npm i -D @lovrozagar/oat`                | `npm i -D @workerstack/testing`                  |
| `oat <command>` (`oat run`, `oat doctor`) | `testing api <command>` (`testing api run`, ...) |
| `oat help`                                | `testing api help`; `testing` lists the subpaths |
| `node dist/cli.js <command>`              | `node dist/api/cli.js <command>`                 |
| `oat: <message>`                          | `testing api: <message>`                         |

## Imports and types

| oat 0.31                                         | @workerstack/testing 0.32                                 |
| ------------------------------------------------ | --------------------------------------------------------- |
| `import { defineConfig } from "@lovrozagar/oat"` | `import { defineConfig } from "@workerstack/testing/api"` |
| `import { steps } from "@lovrozagar/oat/steps"`  | `import { steps } from "@workerstack/testing/api/steps"`  |
| `OatConfig`                                      | `ApiConfig`                                               |

The package has no root export: `import "@workerstack/testing"` fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`.

## Files and folders

| oat 0.31                           | @workerstack/testing 0.32                 |
| ---------------------------------- | ----------------------------------------- |
| `oat.config.ts` (`.mjs`, `.json`)  | `testing.api.config.ts` (`.mjs`, `.json`) |
| `.oat/runs/<datetime>/`            | `.testing/api/runs/<datetime>/`           |
| `oat-report.md`, `oat-report.json` | `report.md`, `report.json`                |
| `.oat/credentials.json`            | `.testing/api/credentials.json`           |
| `oat.baseline.json`                | `testing.api.baseline.json`               |
| `oat-out/`                         | `testing-out/`                            |

`--config` is always explicit, so an `oat.config.ts` still runs when you pass it by that name; `testing api
init` writes `testing.api.config.ts`. Runs under `.oat/runs` are not read: `testing api baseline --from` or
`testing api diff` pointed at one says so. Make a new baseline from a new run.

## Environment

| oat 0.31                               | @workerstack/testing 0.32                      |
| -------------------------------------- | ---------------------------------------------- |
| `OAT_<SCHEME>_TOKEN` written by `init` | `TESTING_API_<SCHEME>_TOKEN` written by `init` |
| `OAT_DEFER_ENV`                        | `TESTING_API_DEFER_ENV`                        |
| `OAT_HEAP_SNAPSHOTS`                   | `TESTING_API_HEAP_SNAPSHOTS`                   |

A config reads the env names it names with `env("...")`, so a config `oat init` wrote keeps reading its
`OAT_*` variables until you rename them. Rename them with the config, so the two stay in step.

## Reports, specs and data

| oat 0.31                                              | @workerstack/testing 0.32                    |
| ----------------------------------------------------- | -------------------------------------------- |
| matrix `"kind": "oat.matrix"`                         | `"kind": "testing.api.matrix"`               |
| JUnit suite `oat.run`                                 | `testing.api.run`                            |
| loader keys `x-oat-defs`, `x-oat-external`, ...       | `x-testing-defs`, `x-testing-external`, ...  |
| reference backend bypass `x-oat-fresh: 1`             | `x-testing-fresh: 1`                         |
| generated values `oat-absent-...`, `oat-baseline-...` | `testing-absent-...`, `testing-baseline-...` |
| generated names `oat_unknown_parameter`               | `testing_unknown_parameter`                  |

A cleanup script or a log filter that matches `oat-` on records the tester created should match `testing-`.

## Lint plugin (contributors)

The repo's own oxlint plugin is `testing`: rule ids are `testing/<rule>` instead of `oat/<rule>`.
