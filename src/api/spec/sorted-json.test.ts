import { describe, expect, it } from "vitest";

import { sortedJson } from "./sorted-json.ts";

// An object whose keys are written in the order given: a literal's would be sorted by the lint.
function written(...fields: Array<[string, unknown]>): object {
  return Object.fromEntries(new Map(fields));
}

describe("sortedJson", () => {
  it("writes every object's keys by name, at any depth, and keeps an array's order", () => {
    const forward = written(["b", [written(["a", 2], ["z", 1]), 3]], ["a", written(["x", "s"], ["y", null])]);
    const reversed = written(["a", written(["y", null], ["x", "s"])], ["b", [written(["z", 1], ["a", 2]), 3]]);
    expect(sortedJson(forward)).toBe('{"a":{"x":"s","y":null},"b":[{"a":2,"z":1},3]}');
    expect(sortedJson(reversed)).toBe(sortedJson(forward));
  });

  it("indents when asked", () => {
    expect(sortedJson(written(["b", 1], ["a", 2]), 2)).toBe('{\n  "a": 2,\n  "b": 1\n}');
  });
});
