import { describe, expect, it } from "vitest";

import { inOrder } from "./in-order.ts";

function fields(extra: { b?: number }) {
  return { a: 1, c: 2, ...extra };
}

describe("inOrder", () => {
  it("returns the same fields with their keys in the list's order", () => {
    const reordered = inOrder(["z", "a", "m"], { a: 1, m: 3, z: 2 });
    expect(Object.keys(reordered)).toStrictEqual(["z", "a", "m"]);
    expect(reordered).toStrictEqual({ a: 1, m: 3, z: 2 });
  });

  it("skips a listed key the value lacks, so an optional field has a place", () => {
    expect(Object.keys(inOrder(["c", "b", "a"], fields({})))).toStrictEqual(["c", "a"]);
    expect(Object.keys(inOrder(["c", "b", "a"], fields({ b: 3 })))).toStrictEqual(["c", "b", "a"]);
  });

  it("throws, naming the key, when the list leaves one out", () => {
    expect(() => inOrder(["a", "c"], fields({ b: 3 }))).toThrow("fields missing from the order: b");
  });
});
