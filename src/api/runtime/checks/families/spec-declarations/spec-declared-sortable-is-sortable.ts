import { sortTerm } from "../../../../spec/conventions/sort.ts";
import type { Outcome } from "../../../finding.ts";
import type { Check } from "../../core/check.ts";
import { defineCheck } from "../../core/define.ts";
import { when } from "../../core/plan.ts";
import { declarationOutcome } from "../../planning/declarations.ts";
import { subjectsOf } from "../../planning/subjects.ts";
import { conv, q } from "../../query/capabilities.ts";
import { list } from "../../sets/list.ts";

/**
 * The sort analog of `declaredFilterableWorks`: `x-query.sortable` is a promise too, and
 * an `order` value the backend rejects breaks every client generated from the document exactly
 * the same way a rejected filter does.
 */
export const declaredSortableWorks: Check = defineCheck({
  dependsOn: [
    "list.read-after-write",
    // ERROR_500_ON_BAD_FILTER, despite its name, turns *any* SqlError the reference throws
    // into a 500 — including a rejected `order` field, not just a malformed filter. Without
    // this dependency a rejection lands outside the 4xx window this check looks for and the
    // overclaim goes unreported: the same "SILENT" failure error.malformed-filter-not-5xx
    // exists to catch, just reached from the sort path instead of the filter path.
    "error.malformed-filter-not-5xx",
    // Found by the fuzzer, not the matrix: on the SQL stores, ORDER_IGNORED short-circuits
    // before the sortable whitelist is even consulted (the field-rejection check sits *after*
    // the ignore-order early return), so a backend that has stopped applying `order` at all
    // also stops rejecting an overclaimed field — the request simply succeeds with the default
    // order. The overclaim is real but unobservable until ordering itself works again.
    "sort.order-is-applied",
  ],
  id: "spec.declared-sortable-is-sortable",
  lists: true,
  needs: "x-query naming sortable fields",
  plan: (ctx) =>
    when(
      conv(ctx).order !== undefined &&
        ctx.query?.source === "tag" &&
        ctx.query.sortable.length > 0 &&
        ctx.records.length > 0,
    ),
  async run(ctx): Promise<Outcome> {
    const conventions = conv(ctx);

    const answers = await Promise.all(
      (ctx.query?.sortable ?? []).map(async (field) => ({
        field,
        result: await list(ctx, q(ctx, { limit: 5, order: sortTerm(conventions, { direction: "asc", field }) })),
      })),
    );

    return declarationOutcome(ctx, answers, {
      consequence:
        "Every client generated from this document will offer an order value that fails at " +
        "runtime. Either the column needs an index or the declaration needs removing — but " +
        "the document and the backend currently disagree about what this API can do.",
      id: this.id,
      kind: "sortable",
      noProbe: "no declared sortable field could be probed",
      summary: "the document declares a sort field the backend does not accept",
    });
  },
  subjects: subjectsOf.list,
});
