#!/usr/bin/env bun
/*
 * `bun scripts/steps.ts <name>`: runs the named sequence of commands in order and stops at the first that fails,
 * exiting with its code. A package.json script that needs more than one tool call names its sequence here, so the
 * order lives in one table instead of in `&&` chains.
 */
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { delimiter, join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
/* The installed tools come first, as `bun run` puts them, so a direct `bun scripts/steps.ts` finds the same ones. */
const PATH = [join(ROOT, "node_modules", ".bin"), process.env["PATH"] ?? ""].join(delimiter);

/** One step: a command and its arguments, or a function run in this process. */
type Step = readonly string[] | (() => void);

const removeDist: Step = () => rmSync(join(ROOT, "dist"), { force: true, recursive: true });
const build: readonly Step[] = [removeDist, ["bun", "run", "build:api"], ["bun", "run", "build:web"]];

/** Each sequence a package.json script runs, by the script's name. */
export const SEQUENCES: Readonly<Record<string, readonly Step[]>> = {
  build,
  demo: [...build, ["bun", "run", "labs:demo"]],
  test: [...build, ["bun", "run", "test:unit"], ["bun", "run", "test:integration"], ["bun", "run", "conformance"]],
  "test:e2e": [...build, ["vitest", "run", "-c", "vitest.e2e.config.ts"]],
  "test:web": [...build, ["playwright", "test"], ["vitest", "run", "-c", "vitest.web.config.ts"]],
  typecheck: [
    ["tsc", "-p", "tsconfig.json", "--noEmit"],
    ["tsc", "-p", "tsconfig.src.json", "--noEmit"],
    ["tsc", "-p", "tsconfig.web.json", "--noEmit"],
    ["bun", "run", "typecheck:test"],
    ["bun", "run", "typecheck:web-test"],
  ],
};

/** Runs `steps` in order; the exit code of the first that fails, else 0. */
export function runSteps(steps: readonly Step[]): number {
  for (const step of steps) {
    if (typeof step === "function") {
      step();
      continue;
    }
    const [command = "", ...args] = step;
    const run = spawnSync(command, args, { cwd: ROOT, env: { ...process.env, PATH }, stdio: "inherit" });
    if (run.error !== undefined) throw run.error;
    if (run.status !== 0) return run.status ?? 1;
  }
  return 0;
}

if (import.meta.main) {
  const name = process.argv[2] ?? "";
  const steps = SEQUENCES[name];
  if (steps === undefined) {
    console.error(`usage: bun scripts/steps.ts <${Object.keys(SEQUENCES).join(" | ")}>`);
    process.exit(2);
  }
  process.exit(runSteps(steps));
}
