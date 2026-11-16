import { describe, expect, it } from "vitest";

import { isMismatch, solidMismatches } from "./mismatches.ts";

// What Solid 2's client runtime logs or throws when hydration and the server disagree.
const SOLID_SAYS = [
  "Hydration Mismatch. Unable to find DOM nodes for hydration key: 0-0-1",
  'Hydration key miss for "0-1": no server-rendered element carries this key. A detached element was created instead',
  'Hydration tag mismatch for key "0-2": expected <span> but found',
  "Hydration structure mismatch: expected <b> as first child of",
  "Hydration completed with 2 unclaimed server-rendered node(s):\n  <i>x</i>",
  "Failed attempt to create new DOM elements during hydration. Check that the libraries you are using support hydration.",
];

describe("isMismatch", () => {
  it.each(SOLID_SAYS)("is true for %s", (text) => {
    expect(isMismatch(text)).toBe(true);
    expect(isMismatch(`Error: ${text}`)).toBe(true);
  });

  it("is false for other output, hydration words included", () => {
    for (const text of ["Hydration completed", "hydrating the shell", "Warning: key prop", "Hydration module preload"])
      expect(isMismatch(text)).toBe(false);
  });
});

describe("solidMismatches", () => {
  it("is a guard list that matches every kind of event Solid's messages arrive as", () => {
    expect(solidMismatches.every((match) => match.kind === undefined)).toBe(true);

    for (const text of SOLID_SAYS) {
      const hit = solidMismatches.some((match) =>
        typeof match.text === "string" ? text.includes(match.text) : match.text.test(text),
      );

      expect(hit).toBe(true);
    }
  });
});
