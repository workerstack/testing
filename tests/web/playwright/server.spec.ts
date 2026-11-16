import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import { CHILD_TIMEOUT_MS, runChild, type ChildRun } from "../support/child-run.ts";

// `appServer` and `defineWebConfig` as a consumer meets them: tests/web/consumer/server.config.ts
// starts the fixture pages on a port the OS picked and runs its specs on two workers. A server that
// fails or never answers fails the run loud, and the run always stops the process it started.

const CONFIG = "tests/web/consumer/server.config.ts";

// Runs the consumer config with `env`, then whether the server process it started is still alive.
function run(env: Record<string, string>): { child: ChildRun; alive: boolean } {
  const dir = mkdtempSync(join(tmpdir(), "web-server-"));
  const pidFile = join(dir, "pid");

  try {
    const child = runChild(CONFIG, { ...env, PAGES_PID_FILE: pidFile });
    const pid = Number(readFileSync(pidFile, "utf8"));

    return { alive: isAlive(pid), child };
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);

    return true;
  } catch {
    return false;
  }
}

const failure = (child: ChildRun): string => [...child.errors, child.stderr].join("\n");

test.describe.configure({ mode: "parallel", timeout: CHILD_TIMEOUT_MS });

test("every worker reaches the one server, which stops when the run ends", () => {
  const { alive, child } = run({});
  const status = Object.fromEntries([...child.specs].map(([title, outcome]) => [title, outcome.status]));
  expect(status, failure(child)).toEqual({
    "a page that becomes usable late reaches its marker": "passed",
    "baseURL is the server on the port the main process kept": "passed",
    "ready.goto opens the app's home page": "passed",
    "the network gate trusts the server and passes an allowed stub": "passed",
  });
  expect(child.code).toBe(0);
  expect(alive).toBe(false);
});

test("a server that fails at start fails the run with its exit code", () => {
  const { alive, child } = run({ PAGES_MODE: "exit" });
  expect(child.code).toBe(1);
  expect(failure(child)).toContain("Process from config.webServer was not able to start. Exit code: 1");
  expect(alive).toBe(false);
});

test("a server that never answers fails the run at its timeout, and is stopped", () => {
  const { alive, child } = run({ PAGES_MODE: "hang", PAGES_START_TIMEOUT: "1000" });
  expect(child.code).toBe(1);
  expect(failure(child)).toContain("Timed out waiting 1000ms from config.webServer.");
  expect(alive).toBe(false);
});
