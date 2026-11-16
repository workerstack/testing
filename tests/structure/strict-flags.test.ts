import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// A key read from a dictionary (a JSON body, headers, env) is written `obj["key"]`, as
// noPropertyAccessFromIndexSignature asks, and a known shape gets a real type instead. A lint rule
// that prefers dot access would undo the first, so none may be on.

const ROOT = join(import.meta.dirname, "..", "..");

const TSC = join(ROOT, "node_modules", "typescript", "bin", "tsc");

/** The compiler options `config` resolves to, its `extends` chain included. */
function optionsOf(config: string): Record<string, unknown> {
  const run = spawnSync(process.execPath, [TSC, "-p", config, "--showConfig"], { cwd: ROOT, encoding: "utf8" });
  const shown = JSON.parse(run.stdout) as { compilerOptions: Record<string, unknown> };

  return shown.compilerOptions;
}

describe("the strict TypeScript flags", () => {
  it("hold index-signature reads to brackets, and src declarations to explicit types", () => {
    expect(optionsOf("tsconfig.json")["noPropertyAccessFromIndexSignature"]).toBe(true);
    expect(optionsOf("tsconfig.build.json")["isolatedDeclarations"]).toBe(true);
  });

  it("are not fought by a lint rule that turns bracket access back into dots", () => {
    // The config the standards pack generates; sync writes it on install, under a `//` header line.
    const config = JSON.parse(readFileSync(join(ROOT, ".oxlintrc.jsonc"), "utf8").replace(/^\/\/.*\n/, "")) as Record<
      string,
      unknown
    >;

    const overrides = (config["overrides"] ?? []) as Array<{ rules?: Record<string, unknown> }>;

    const rules = [config["rules"] ?? {}, ...overrides.map((override) => override.rules ?? {})].flatMap((set) =>
      Object.keys(set),
    );

    expect(config["extends"]).toBeUndefined();
    expect(rules.filter((rule) => /(^|\/)dot-notation$/.test(rule))).toEqual([]);
  });
});
