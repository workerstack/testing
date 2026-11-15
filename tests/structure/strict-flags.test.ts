import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/*
 * A key read from a dictionary (a JSON body, headers, env) is written `obj["key"]`, as
 * noPropertyAccessFromIndexSignature asks, and a known shape gets a real type instead. A lint rule
 * that prefers dot access would undo the first, so none may be on.
 */

const ROOT = join(import.meta.dirname, "..", "..");
const json = (file: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(ROOT, file), "utf8")) as Record<string, unknown>;

describe("the strict TypeScript flags", () => {
  it("hold index-signature reads to brackets, and src declarations to explicit types", () => {
    const options = json("tsconfig.json")["compilerOptions"] as Record<string, unknown>;
    expect(options["noPropertyAccessFromIndexSignature"]).toBe(true);
    expect(options["isolatedDeclarations"]).toBe(true);
  });

  it("are not fought by a lint rule that turns bracket access back into dots", () => {
    /* The config the standards pack generates; sync writes it on install, under a `//` header line. */
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
