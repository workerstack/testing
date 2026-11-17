import { selectTerm } from "../../../../spec/conventions/select.ts";
import type { Outcome } from "../../../finding.ts";
import type { Check } from "../../core/check.ts";
import { defineCheck } from "../../core/define.ts";
import { when } from "../../core/plan.ts";
import { declarationOutcome } from "../../planning/declarations.ts";
import { subjectsOf } from "../../planning/subjects.ts";
import { conv, q } from "../../query/capabilities.ts";
import { list } from "../../sets/list.ts";

/**
 * The select analog of `declaredFilterableWorks` and `declaredSortableWorks`:
 * `x-query.selectable` is a promise too, and a sparse fieldset the backend rejects breaks every
 * client generated from the document exactly the same way a rejected filter or sort does.
 */
export const declaredSelectableWorks: Check = defineCheck({
  dependsOn: [
    "list.read-after-write",
    // Same masking risk as the filter and sort overclaim checks: ERROR_500_ON_BAD_FILTER turns
    // any rejection — this one included — into a 500, which would fall outside the 4xx window
    // below and read as accepted.
    "error.malformed-filter-not-5xx",
    // Same shape as the sort check's dependency on sort.order-is-applied, found by inspection
    // before the fuzzer had to: `project()` returns the row untouched under SELECT_IGNORED
    // *before* the excluded-field check runs, so a backend that has stopped honoring `select`
    // at all also stops rejecting an overclaimed field — the request just returns every column.
    "select.projection-honored",
  ],
  id: "spec.declared-selectable-is-selectable",
  lists: true,
  needs: "x-query naming selectable fields",
  plan: (ctx) =>
    when(
      conv(ctx).select !== undefined &&
        ctx.query?.source === "tag" &&
        ctx.query.selectable.length > 0 &&
        ctx.records.length > 0,
    ),
  async run(ctx): Promise<Outcome> {
    const conventions = conv(ctx);

    const answers = await Promise.all(
      (ctx.query?.selectable ?? []).map(async (field) => {
        const projection = selectTerm(conventions, [ctx.identity, field], ctx.entityName);

        if (projection === null) return null;

        return { field, result: await list(ctx, { ...q(ctx, { limit: 5 }), ...projection }) };
      }),
    );

    return declarationOutcome(
      ctx,
      answers.filter((answered) => answered !== null),
      {
        consequence:
          "Every client generated from this document will offer a sparse fieldset that fails at " +
          "runtime. Either the field needs to stay projectable or the declaration needs " +
          "removing — but the document and the backend currently disagree about what this API " +
          "can do.",
        id: this.id,
        kind: "selectable",
        noProbe: "no declared selectable field could be probed",
        summary: "the document declares a select field the backend does not accept",
      },
    );
  },
  subjects: subjectsOf.list,
});
