import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/*
 * The README is the front page: what the API tester is, how to start, how auth is declared, what a run's
 * verdicts and exit codes mean, a CI sketch, the limits that matter most, and where every other doc
 * is. `bun repo sync` generates it from references/: a title, the package description, a contents list, then
 * each reference under its own `## ` heading, the user's first and the contributors' (Gates onward) last.
 * The user's part stays about 120 lines; the full limits live in docs/api/limits.md and the run
 * walkthrough in docs/api/model.md, so nothing the README drops is lost.
 */

const ROOT = join(import.meta.dirname, "..", "..");
const README = readFileSync(join(ROOT, "README.md"), "utf8");
const read = (...path: string[]): string => readFileSync(join(ROOT, ...path), "utf8");

/** A `## ` or `### ` heading's text, up to the next `## `. */
function section(heading: string): string {
  const start = [`\n## ${heading}\n`, `\n### ${heading}\n`].map((line) => README.indexOf(line)).find((at) => at !== -1);
  if (start === undefined) return "";
  const next = README.indexOf("\n## ", start + 1);
  return next === -1 ? README.slice(start) : README.slice(start, next);
}

/** The sections a user reads: Overview up to the first contributor section. */
const USER_PART = README.slice(README.indexOf("\n## Overview\n"), README.indexOf("\n## Gates\n"));

describe("the README", () => {
  it("keeps the user's part about 120 lines", () => {
    const lines = USER_PART.trim().split("\n").length;
    expect(lines).toBeGreaterThanOrEqual(100);
    expect(lines).toBeLessThanOrEqual(140);
  });

  it("starts a user with doctor, then init, then run, on the OpenAPI versions the API tester reads", () => {
    const start = section("Quick start");
    const at = (command: string) => start.indexOf(`testing api ${command}`);
    expect(at("doctor")).toBeGreaterThan(-1);
    expect(at("doctor")).toBeLessThan(at("init"));
    expect(at("init")).toBeLessThan(at("run"));
    expect(README).toMatch(/OpenAPI 3\.0.{0,3}3\.2/);
  });

  it("shows a bearer config and the auth recipe kinds", () => {
    const auth = section("Authentication");
    expect(auth).toContain("security: { bearer: { static:");
    for (const kind of ["login", "mint", "static", "hook", "oauth2"]) expect(auth).toContain(`\`${kind}`);
  });

  it("names every verdict and every exit code from 0 to 4, saying any non-zero fails CI", () => {
    const verdicts = section("Verdicts and exit codes");
    for (const verdict of ["BACKEND_BUG", "SPEC_BUG", "SECURITY", "AMBIGUITY", "COVERAGE_GAP", "BLOCKED"])
      expect(verdicts).toContain(`\`${verdict}\``);
    for (const code of [0, 1, 2, 3, 4]) expect(verdicts).toMatch(new RegExp(`\\| \`${code}\` +\\|`));
    expect(verdicts).toMatch(/any non-zero exit fails/i);
    expect(section("CI")).toContain("testing api run --config");
  });

  it("links every top-level doc from its index", () => {
    const docs = readdirSync(join(ROOT, "docs", "api")).filter((name) => name.endsWith(".md"));
    const index = section("Docs");
    expect(docs.filter((name) => !index.includes(`(docs/api/${name})`))).toEqual([]);
  });

  it("keeps what it no longer says: the full limits in docs/api/limits.md, the run walkthrough in docs/api/model.md", () => {
    expect(section("Limits")).toContain("(docs/api/limits.md)");
    expect(read("docs", "api", "limits.md")).toContain("Default request timeout is 180s");
    expect(read("docs", "api", "limits.md")).toContain("A long `Retry-After` is not waited for");
    expect(read("docs", "api", "model.md")).toContain("## How a run works");
    expect(read("docs", "api", "model.md")).toContain("**Teardown** everything the run created");
  });

  it("names both subpaths in the overview, and links the web doc from its index", () => {
    const intro = section("Overview");
    expect(intro).toContain("`/api`");
    expect(intro).toContain("`/web`");
    expect(section("Docs")).toContain("(docs/web/web.md)");
  });
});
