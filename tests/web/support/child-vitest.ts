import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { childEnv, type Outcome } from "./child-run.ts";

// A consumer's vitest run, started from a spec here: its own process in the consumer's folder, so
// its config, its node_modules and its vite cache are the consumer's, reporting each test as JSON.

const ROOT = join(import.meta.dirname, "..", "..", "..");
export const VITEST_TIMEOUT_MS = 120_000;

export type VitestRun = {
  /** The run's exit code. */
  code: number | null;
  /** Each test's full name, with its status and failure text. */
  tests: Map<string, Outcome>;
  /** What the run printed to stderr, where a config or startup failure shows. */
  stderr: string;
};

type Report = {
  testResults: Array<{
    message?: string;
    assertionResults: Array<{ fullName: string; status: string; failureMessages: string[] }>;
  }>;
};

/** Runs vitest in `dir` (a path from the repo root) with the config there, and reads its report. */
export function runVitest(dir: string): VitestRun {
  const out = mkdtempSync(join(tmpdir(), "child-vitest-"));
  const file = join(out, "report.json");

  try {
    const child = spawnSync(
      join(ROOT, "node_modules", ".bin", "vitest"),
      ["run", "--reporter=json", `--outputFile=${file}`],
      {
        cwd: join(ROOT, dir),
        encoding: "utf8",
        env: childEnv(),
        timeout: VITEST_TIMEOUT_MS,
      },
    );

    return { ...read(file, `${child.stdout}\n${child.stderr}`), code: child.status };
  } finally {
    rmSync(out, { force: true, recursive: true });
  }
}

function read(file: string, printed: string): Omit<VitestRun, "code"> {
  let report: Report;

  try {
    report = JSON.parse(readFileSync(file, "utf8")) as Report;
  } catch (cause) {
    throw new Error(`the vitest run wrote no report:\n${printed}`, { cause });
  }

  const tests = report.testResults.flatMap((one) =>
    one.assertionResults.map((test): [string, Outcome] => [
      test.fullName,
      { message: test.failureMessages.join("\n"), status: test.status },
    ]),
  );

  const fileErrors = report.testResults.flatMap((one) => (one.message ? [one.message] : []));

  return { stderr: [printed, ...fileErrors].join("\n"), tests: new Map(tests) };
}
