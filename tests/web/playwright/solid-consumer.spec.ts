import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import { VITEST_TIMEOUT_MS, runVitest } from "../support/child-vitest.ts";

/*
 * `./web/solid` as an npm user meets it: the packed tarball under the consumer's own node_modules,
 * not this repo's self-reference, so vite loads it as a dependency for the server render and for
 * the browser bundle. The consumer's hydration and server tests pass, and vite logs no missing source map.
 */

const ROOT = join(import.meta.dirname, "..", "..", "..");
const CONSUMER = join(ROOT, "tests", "web", "solid-consumer");

function installTarball(): void {
  const packed = mkdtempSync(join(tmpdir(), "solid-consumer-"));
  try {
    const [info] = JSON.parse(
      execFileSync("npm", ["pack", "--ignore-scripts", "--json", "--pack-destination", packed], {
        cwd: ROOT,
        encoding: "utf8",
      }),
    ) as Array<{ filename: string }>;
    const target = join(CONSUMER, "node_modules", "@workerstack", "testing");
    rmSync(join(CONSUMER, "node_modules"), { force: true, recursive: true });
    mkdirSync(target, { recursive: true });
    execFileSync("tar", ["-xzf", join(packed, info?.filename ?? ""), "-C", target, "--strip-components=1"]);
  } finally {
    rmSync(packed, { force: true, recursive: true });
  }
}

// The install goes once the run is done: left behind, it changes what type-aware lint sees in the consumer.
function runVitestThenUninstall(): ReturnType<typeof runVitest> {
  try {
    return runVitest("tests/web/solid-consumer");
  } finally {
    rmSync(join(CONSUMER, "node_modules"), { force: true, recursive: true });
  }
}

test("a consumer hydrates and server-renders its fixtures through the packed package", () => {
  test.setTimeout(VITEST_TIMEOUT_MS + 60_000);
  installTarball();
  const run = runVitestThenUninstall();
  const status = Object.fromEntries([...run.tests].map(([name, outcome]) => [name, outcome.status]));
  expect(status, run.stderr).toEqual({
    "a packed consumer hydrates a clean button and reads its server HTML": "passed",
    "a packed consumer reports the element the server rendered differently": "passed",
    "a packed consumer rejects with the plugin's line when a fixture has no such export": "passed",
    "a packed consumer's server test renders a component that reads Solid's owner": "passed",
  });
  expect(run.stderr).not.toContain("Failed to load source map");
  expect(run.code).toBe(0);
});
