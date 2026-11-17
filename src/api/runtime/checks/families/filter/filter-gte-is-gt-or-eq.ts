import type { Outcome } from "../../../finding.ts";
import type { Check } from "../../core/check.ts";
import { defineCheck } from "../../core/define.ts";
import { subjectsOf } from "../../planning/subjects.ts";
import { FOUNDATIONS } from "../../query/capabilities.ts";
import { assertRangeUnion, rangePlan, type RangeProbe } from "./range.ts";

export const filterGteIsGtOrEq: Check<RangeProbe> = defineCheck<RangeProbe>({
  dependsOn: [
    "query.filter-selects-from-whole-set",
    ...FOUNDATIONS,
    "filter.equality-selects-exactly-one",
    "filter.numeric-comparison-is-numeric",
  ],
  id: "filter.gte-is-gt-or-eq",
  lists: true,
  needs: "an ordered field that allows `gte` and `gt`",
  plan: (ctx) => rangePlan(ctx, "gte", "gt"),
  async run(ctx, probe): Promise<Outcome> {
    return assertRangeUnion(ctx, this.id, probe);
  },
  subjects: subjectsOf.list,
});
