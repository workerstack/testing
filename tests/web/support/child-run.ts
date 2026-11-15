import { spawnSync } from "node:child_process";
import { join } from "node:path";

/*
 * A consumer's Playwright run, started from a spec here: its own process, with none of this run's
 * worker or port variables, reporting each spec's status and error text as JSON.
 */

const ROOT = join(import.meta.dirname, "..", "..", "..");
export const CHILD_TIMEOUT_MS = 120_000;

export interface Outcome {
  status: string;
  message: string;
}

export interface ChildRun {
  /** The run's exit code. */
  code: number | null;
  /** Each spec title, with its one result's status and error text. */
  specs: Map<string, Outcome>;
  /** What the run printed to stderr, where a webServer failure shows. */
  stderr: string;
  /** The JSON report's top-level errors, such as a webServer that never started. */
  errors: string[];
}

interface Suite {
  suites?: Suite[];
  specs?: Array<{
    title: string;
    tests: Array<{ results: Array<{ status: string; errors: Array<{ message?: string }> }> }>;
  }>;
}

function outcomes(suite: Suite): Array<[string, Outcome]> {
  const own = (suite.specs ?? []).map((spec): [string, Outcome] => {
    const result = spec.tests[0]?.results[0];
    const message = (result?.errors ?? []).map((error) => error.message ?? "").join("\n");
    return [spec.title, { message, status: result?.status ?? "missing" }];
  });
  return [...own, ...(suite.suites ?? []).flatMap(outcomes)];
}

/** The env a child run starts with: this run's, less its worker and kept-port variables, plus `extra`. */
export function childEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const kept = Object.entries(process.env).filter(([name]) => !/^(PW_|PLAYWRIGHT_|TEST_|WORKERSTACK_WEB_)/.test(name));
  return { ...Object.fromEntries(kept), FORCE_COLOR: "0", ...extra };
}

/** Runs the consumer project `config` (a path from the repo root) and reads its report. */
export function runChild(config: string, extra: Record<string, string> = {}): ChildRun {
  const child = spawnSync(join(ROOT, "node_modules", ".bin", "playwright"), ["test", "-c", config, "--reporter=json"], {
    cwd: ROOT,
    encoding: "utf8",
    env: childEnv(extra),
    timeout: CHILD_TIMEOUT_MS,
  });
  if (child.stdout === "") throw new Error(`the child run printed no report:\n${child.stderr}`);
  const report = JSON.parse(child.stdout) as { suites: Suite[]; errors?: Array<{ message?: string }> };
  return {
    code: child.status,
    errors: (report.errors ?? []).map((error) => error.message ?? ""),
    specs: new Map(report.suites.flatMap(outcomes)),
    stderr: child.stderr,
  };
}
