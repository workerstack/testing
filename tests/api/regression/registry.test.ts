import { describe, expect, it } from "vitest";

import { CHECKS } from "../../../src/api/runtime/checks/registry.ts";

// A row's fields in the order the golden reads them: the check, then what it waits for and does.
const ROW_ORDER: readonly string[] = ["id", "dependsOn", "mutates", "judgesTranscript", "needs"];

describe("check registry golden", () => {
  // Order is behavior: a check runs after the ones it depends on, and mutating checks run alone
  // in registry order. The split of checks.ts must keep every row as it is.
  it("ids, order, dependencies, mutation and transcript judging", async () => {
    const rows = CHECKS.map((check) => ({
      dependsOn: check.subject === "operation" ? [] : (check.dependsOn ?? []),
      id: check.id,
      judgesTranscript: check.subject !== "operation" && check.judgesTranscript === true,
      mutates: check.mutates === true,
      ...(check.needs === undefined ? {} : { needs: check.needs }),
    }));

    await expect(`${JSON.stringify(rows, [...ROW_ORDER], 2)}\n`).toMatchFileSnapshot("__snapshots__/registry.snap");
  });
});
