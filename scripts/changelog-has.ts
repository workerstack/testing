#!/usr/bin/env bun
/*
 * `bun scripts/changelog-has.ts <version>`: exits 0 when CHANGELOG.md has a `## [<version>] - <date>` heading,
 * else 1 naming what is missing. The release runs it before anything is published, so a version
 * goes out only with the changelog that says what is in it.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Whether `changelog` has a line that is exactly `## [<version>] - YYYY-MM-DD`, as Keep a Changelog writes it. */
export function hasHeading(changelog: string, version: string): boolean {
  const heading = `## [${version}] - `;
  return changelog
    .split("\n")
    .some((line) => line.startsWith(heading) && /^\d{4}-\d{2}-\d{2}$/.test(line.trimEnd().slice(heading.length)));
}

if (import.meta.main) {
  const version = (process.argv[2] ?? "").replace(/^v/, "");
  const changelog = readFileSync(join(import.meta.dirname, "..", "CHANGELOG.md"), "utf8");
  if (version === "" || !hasHeading(changelog, version)) {
    console.error(`CHANGELOG.md has no "## [${version}] - YYYY-MM-DD" heading: add one before tagging v${version}`);
    process.exit(1);
  }
}
