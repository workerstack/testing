import { describe, expect, it } from "vitest";

import { entriesByName } from "./entries-by-name.ts";

describe("entriesByName", () => {
  it("sorts by key whichever order the record was written in", () => {
    const written = Object.fromEntries([
      ["c", 3],
      ["a", 1],
      ["b", 2],
    ]);

    expect(entriesByName(written)).toStrictEqual([
      ["a", 1],
      ["b", 2],
      ["c", 3],
    ]);
    expect(entriesByName({})).toStrictEqual([]);
  });

  it("orders by code unit, not locale: upper case before lower case, non-ASCII after ASCII", () => {
    const written = Object.fromEntries([
      ["é", 1],
      ["a", 2],
      ["Z", 3],
    ]);

    expect(entriesByName(written).map(([name]) => name)).toStrictEqual(["Z", "a", "é"]);
  });
});
