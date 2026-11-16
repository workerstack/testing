import { describe, expect, it } from "vitest";

import { cellText, parseCell } from "./cell.ts";

describe("parseCell", () => {
  it("reads back the JSON a store wrote", () => {
    expect(parseCell('{"x":1,"y":[true,null]}')).toStrictEqual({ x: 1, y: [true, null] });
  });
});

describe("cellText", () => {
  it("writes a scalar as String would, an absent field included", () => {
    expect([cellText("a"), cellText(7), cellText(false), cellText(null), cellText(undefined)]).toStrictEqual([
      "a",
      "7",
      "false",
      "null",
      "undefined",
    ]);
  });

  it("refuses an object or a list, which String would write as [object Object]", () => {
    expect(() => cellText({ x: 1 })).toThrow(new TypeError('{"x":1} is not a scalar, so it has no text form'));
    expect(() => cellText([1])).toThrow(new TypeError("[1] is not a scalar, so it has no text form"));
  });
});
