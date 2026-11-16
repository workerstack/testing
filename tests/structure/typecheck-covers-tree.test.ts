import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import { describe, expect, it } from "vitest";

// The type-aware linter reads each file with the nearest tsconfig.json that includes it; a file it
// leaves out is read with loose defaults, where `x?.y` is never undefined, so the lint's fixes delete
// casts and `=== true` checks that tsc needs. So the nearest tsconfig.json above each TypeScript
// or JavaScript file must include it: the root one, or src/web's and tests/web's, which add the DOM.

const ROOT = join(import.meta.dirname, "..", "..");
const TSC = join(ROOT, "node_modules", "typescript", "bin", "tsc");

function tracked(): string[] {
  const run = spawnSync("git", ["ls-files", "--", "*.ts", "*.tsx", "*.mts", "*.js", "*.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
  });

  return run.stdout.split("\n").filter((file) => file !== "" && !file.endsWith(".d.ts"));
}

/** The tsconfig.json in the closest folder above `file`, as a path from the root. */
function nearest(file: string): string {
  let dir = dirname(file);

  while (dir !== "." && !existsSync(join(ROOT, dir, "tsconfig.json"))) dir = dirname(dir);

  return dir === "." ? "tsconfig.json" : `${dir}/tsconfig.json`;
}

/** The files the program of `config` reads, as paths from the root. */
function program(config: string): Set<string> {
  const run = spawnSync(process.execPath, [TSC, "-p", config, "--listFilesOnly"], { cwd: ROOT, encoding: "utf8" });

  return new Set(run.stdout.split("\n").map((file) => relative(ROOT, file.trim())));
}

describe("the tsconfig.json files", () => {
  it("each own the tracked TypeScript under them, so lint reads every file with the strict flags", () => {
    const programs = new Map<string, Set<string>>();

    const ownedBy = (config: string): Set<string> =>
      programs.get(config) ?? programs.set(config, program(config)).get(config) ?? new Set();

    expect(tracked().filter((file) => !ownedBy(nearest(file)).has(file))).toStrictEqual([]);
  });
});
