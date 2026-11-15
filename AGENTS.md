<!-- repo:rules 8c38aa66 -->
Write in en-US, in extremely plain words: short sentences, common words, one idea each. Say only what the person needs to act. One sentence is fine when that is the whole answer. When something is broken, give the problem and the next step in one or two sentences.

Work as a partner who needs this to ship. Use "we" for the goal, "you" for their steps, "I" for yours.

Start with where we stand: what is done, what is stuck or not checked, with paths, counts, and pass or fail. Bad news first. A mixed result stays mixed. If they must act, give exact steps grouped by where they do them, then what you will do next. End with the one next action or decision.

Never use jargon or internal names they did not use, arrows, `key=value` tokens, sentence fragments, background they did not ask for, praise, reassurance, or hedging.

These rules are for replies to the person. Plans, commits, PRs, docs, code comments, prompts to other agents, and skill output keep their own format.

An example, or a list ending in `...` or `etc`, stands for a kind of thing. Do everything of that kind that fits, not only the named items, and nothing outside it. Closed instructions stay literal.

Ship only the optimal solution. If what exists is not optimal, rewrite it. Leave no monkey-patches, workarounds, shims or TODOs in code. Flag blockers. When advising, be thorough in the analysis and bold in the recommendation: pick the best option from research, data and reasoning, not from what the user seems to want. Change it only for new evidence or a flaw you found; pushback alone is not a reason. Do and check the work yourself with every tool you have. Do not guess, and do not hand the user work you could do. Ask only when you truly cannot find out, and say what you tried. Under `/away`, never ask: decide, log each choice as a `- decision:` entry, and let the hook run a reviewed approval block. Stopping for approval of a written plan is not stopping short. Add no AI attribution, Co-Authored-By, or generated markers.

Before you change anything, read `node_modules/@workerstack/repo/references/scope.md`. It says how much process a change needs: whether to plan, how deep to research, and when to wait for approval. Whatever the process, ask the user only what they alone can answer.

Every change happens in a worktree. Run `bun repo worktree add <name>`, then edit, test and commit in `.worktrees/<name>`, then run `bun repo worktree finish <name>` from the root. Never write product files in the main checkout. Any git is fine in your worktree. In the main checkout or on the default branch, run no destructive git (stash, reset, checkout, switch, restore, clean, rebase, force push, deleting the default branch) unless the user asked. Never drop stashes you did not make.

Read `node_modules/@workerstack/repo/references/INDEX.md` once. When a line matches the work, read that file in full. No folder map in your context? Run `bun repo map [dir]`, not `ls` or `find`.

Found work outside the task? Run `bun repo backlog add "<text>"`, don't do it now, and name it in your reply.

When a change needs a plan and no skill was named, use the plan skills of the effort the hook context names: /write-plan-{effort} and /implement-plan-{effort}, or /write-roadmap-{effort} and /implement-roadmap-{effort} for two or more slices.
<!-- /repo:rules -->

## Writing style

en-US English everywhere — code, comments, docs, commit messages.

## Tests are the truth

Every change starts with a test: a bug, a reported issue, a review finding, a feature, a refactor. Red: write the
test and run it to show it fails, for the reason the test names. Fix: the smallest change that makes it pass. Green:
run it again, then the tests the change reaches. A fix without a test that failed first is not done. Detail:
`references/tdd.md`.

Locally, a commit runs the tests its change reaches. CI on the pushed tip is the full gate: `fmt:check`, `lint`,
`typecheck`, `test`, `test:integration`, `test:e2e` and `test:web`. After a push, `bun scripts/ci-wait.ts` waits for the run and
names any failed job and its log. While CI is red, the only work is fixing it. Never use `--no-verify`. A failure is
never skipped, retried away, or called flaky. Detail: `references/gates.md`.

## Git

Work on the `wt/<name>` branch of your worktree. `bun repo worktree add` makes it and `finish`
lands it on `main`; don't create, switch, or delete branches by hand.

Fine without asking: `status`, `diff`, `log`, `add`, `commit`, and `bun repo push` from the root
after `finish`.

`@workerstack/repo` is pinned to its npm version, so CI installs it from npm. To work on the local
`repo` checkout, run `bun repo link @workerstack/repo` in the main checkout and in each worktree, after
`bun install`. `bun repo unlink @workerstack/repo` puts npm back.

Ask first, and wait, in the main checkout or on `main`: anything that can lose work — `reset --hard`, `checkout` /
`restore` over uncommitted changes, `clean`, `stash` (any form), `push --force`
(including `--force-with-lease`), `rebase`, `cherry-pick`, `revert`,
`commit --amend`, deleting tags, anything reflog-driven. If you can't tell,
assume it can.

## Architecture rules

The linter and `tests/structure/` enforce each of these; a broken one fails a gate.

- **Limits.** At most 300 lines a file (500 for tests and fixtures), 60 lines a function,
  complexity 15, nesting depth 4, and 3 parameters (pass an object beyond that).
- **Layout.** Every module has a sibling `*.test.ts`, except an index, a types-only file and an
  entry point. Colocated tests open no socket; tests that need one live under `tests/`. There is
  no `test/` directory, and the package ships no test or fixture.
- **Arrows.** Imports point down, never up or across: errors, config/types → security, steps → spec →
  client, credentials, reference → runtime (checks included) → runtime/run → config, report,
  conformance → cli, index. steps (the `@workerstack/testing/api/steps` builders) imports only the step
  types and the errors. The reference backend is its own program: it never imports the client
  or the runtime. web (`src/web`) imports node builtins, its own files and its declared optional peers
  (Playwright, axe, vitest); web/solid adds Solid; web/dom runs in the page and imports only itself and vitest.
  web and the API tester never import each other.
  No import cycles, type-only imports included.
- **Naming.** A module is named for what it does. No `utils`, `helpers` or `misc` file or
  directory, and no barrel: `export *` appears nowhere, and `src/api/index.ts` names each export.
- **Red first.** Red is a step, not a commit. Write the test, run it and see it fail, then write
  the fix; the failing test and the fix land together in one `fix:` or `feat:` commit, because
  every commit is verified before it is pushed.
- **anyrow acceptance.** A release candidate passes the procedure in `tests/api/targets/anyrow.md`
  by hand before it is tagged, and `bun run test:targets` matches every target's expected
  findings exactly.

## Before you call it done

From the repo root; CI runs the same set, with `fmt:check` in place of `fmt`.

    bun run fmt          # oxfmt, rewrites in place
    bun run lint         # oxlint
    bun run check        # tsc --noEmit
    bun run test         # builds, then the conformance suite

`test` shells out to `node` on purpose: Node (22.18 or later) is the runtime
The API tester ships against, even though Bun drives the scripts.
