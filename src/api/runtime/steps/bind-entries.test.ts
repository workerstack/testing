import { describe, expect, it } from "vitest";

import { stepStage } from "./__fixtures__/flows.ts";
import { bindEntries } from "./bind-entries.ts";
import { runSteps } from "./engine.ts";

const written = Object.fromEntries([
  ["value", "$.{key}"],
  ["key", "$.k"],
]);

describe("bindEntries", () => {
  it("lists the entries after the siblings they read, whatever order the keys were written in", () => {
    expect(bindEntries(written, "saveAs")).toStrictEqual([
      ["key", "$.k"],
      ["value", "$.{key}"],
    ]);
    expect(bindEntries({ key: "$.k", value: "$.{key}" }, "saveAs")).toStrictEqual([
      ["key", "$.k"],
      ["value", "$.{key}"],
    ]);
    expect(bindEntries(undefined, "bind")).toStrictEqual([]);
  });

  it("stops on a cycle, naming the entries, and lets an entry read its own name from the scope", () => {
    expect(() => bindEntries({ a: "{b}", b: "{a}" }, "bind")).toThrow("bind entries read each other in a cycle: a, b");
    expect(bindEntries({ a: "{a}" }, "saveAs")).toStrictEqual([["a", "{a}"]]);
  });
});

describe("runSteps: entries that read each other", () => {
  it("saves a sibling's name first, then the value its path names, with either written first", async () => {
    const { ctx } = stepStage(() => ({ body: { k: "token", token: "t1" }, status: 201 }));

    const out = await runSteps(ctx, [{ operationId: "auth.token", saveAs: written }], { scope: {} });
    expect(out.scope).toStrictEqual({ key: "token", value: "t1" });
  });

  it("fills a bind's sibling first", async () => {
    const { ctx } = stepStage(() => ({ body: {}, status: 201 }));

    const bind = Object.fromEntries([
      ["b", "{a}-y"],
      ["a", "x"],
    ]);

    const out = await runSteps(ctx, [{ bind, operationId: "auth.token" }], { scope: {} });
    expect(out.scope).toStrictEqual({ a: "x", b: "x-y" });
  });
});
