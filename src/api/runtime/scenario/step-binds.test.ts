import { describe, expect, it } from "vitest";

import { notes, runOf } from "./__fixtures__/stage.ts";
import { runStep } from "./step.ts";

const dependencyFirst = { a: "x", b: "{a}-y" };

const dependentFirst = Object.fromEntries([
  ["b", "{a}-y"],
  ["a", "x"],
]);

describe("runStep: binds that read each other", () => {
  it("fills a sibling's read first, with the dependency written first", async () => {
    const run = runOf(notes());
    await runStep(run, { bind: dependencyFirst, operationId: "notes.list" }, 0);
    expect(run.scope["b"]).toBe("x-y");
  });

  it("fills a sibling's read first, with the dependent written first", async () => {
    const run = runOf(notes());
    await runStep(run, { bind: dependentFirst, operationId: "notes.list" }, 0);
    expect(run.scope["b"]).toBe("x-y");
  });

  it("stops on a cycle among siblings", async () => {
    const cycle = runStep(runOf(notes()), { bind: { a: "{b}", b: "{a}" }, operationId: "notes.list" }, 0);
    await expect(cycle).rejects.toThrow("bind entries read each other in a cycle: a, b");
  });
});
