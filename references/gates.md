---
description: Gates, push, CI and release
---

# Gates

## Script contract

This repo has these `package.json` scripts. Hooks and CI call only these names and `bun repo`, so a tool change is one line in `package.json`. A script runs one tool; one that needs several names its sequence in `scripts/steps.ts`.

| script              | runs                                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `fmt` / `fmt:check` | `repo fmt`, with the standards pack's generated `.oxfmtrc.jsonc`                                                                |
| `lint` / `lint:fix` | `repo lint`: oxlint with the generated `.oxlintrc.jsonc`, plus the repo's own rule plugin in `lint/`, registered in `repo.config.ts` |
| `typecheck`         | `tsc --noEmit` over each `tsconfig.json` (the root, `src/web`, `tests/web`) and each build config                               |
| `test`              | the build, then the unit and integration suites and the conformance self-test                                                  |

## Where each gate runs

The standards pack writes the hooks into `.githooks/` and points `core.hooksPath` at it.

| when       | what                                                                                                                                                   | blocks                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------- |
| pre-commit | `repo precommit`: format, lint under `.repo/lint-baseline.json`, typecheck, sync and the related tests of the staged files, then `repo check`          | the commit            |
| commit-msg | `repo commit-msg` (Conventional Commits)                                                                                                                | the commit            |
| pre-push   | `repo link --pre-push`, then `repo commit-msg --pre-push` on every pushed commit                                                                       | the push              |
| CI         | every push to `main`: the `commits` job runs `repo commit-msg --range` on the pushed commits; then `fmt:check`, `repo check`, `typecheck`, `test`, `test:integration`, `test:e2e`, `test:web` | new work, until fixed |

`.repo/lint-baseline.json` is the adoption ratchet: it holds each file's count of each rule the code broke when the standards pack came in. `repo check` fails a count above its entry, so a count only goes down; `bun repo lint --baseline` rewrites it after a fix.

`tests/structure/workflows.test.ts` checks the jobs in `.github/workflows/ci.yml`.

## Push and CI

No full suite runs locally. Each commit runs the tests its change reaches: the touched test files and the tests of the code it changed. Then push, and run `bun repo ci wait` in the background. It waits for CI's run on the pushed commit and names any failed job and its log: read the log, fix, commit, push, and wait again. A push cancels the run before it, so batch the commits and push once.

## Release

The version bump rides in the final push. Only a commit whose CI run passed on `main` gets the `v*` tag. The release workflow runs no tests: it waits for that commit's `ci.yml` push run and publishes on its success, so a bump made after the green push is a new commit and costs another CI run.

## Browsers

- Chrome: `offscreen --hypr` adds a hidden virtual monitor to the running Hyprland; tests drive Chrome on it over CDP. It never takes focus. `exec` and `run` are refused in that mode.
- Safari: the MacBook Air M3 over Tailscale (`ssh mac`, `safaridriver -p 4799`), one run at a time.
