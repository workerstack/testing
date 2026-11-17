/**
 * Defects the reference backend can be told to exhibit.
 *
 * Each one is a real bug seen in production APIs, reduced to its smallest form. The conformance
 * suite switches them on individually and asserts the API tester reports exactly that defect and nothing
 * else — which is what turns "the API tester is smart" into precision and recall numbers.
 *
 * Keep the implementations naive and obvious. If the reference backend grows clever it starts
 * encoding the same assumptions the API tester does, and the two drift together into agreeing on nonsense.
 */

import { CATALOG_DEFECT_ORDER, CATALOG_DEFECTS } from "./catalog.ts";
import { COMPOSITION_DEFECT_ORDER, COMPOSITION_DEFECTS } from "./composition.ts";
import { CORE_DEFECT_ORDER, CORE_DEFECTS } from "./core.ts";
import { FRESHNESS_DEFECT_ORDER, FRESHNESS_DEFECTS } from "./freshness.ts";
import { QUERY_DEFECT_ORDER, QUERY_DEFECTS } from "./query.ts";
import { RECORD_DEFECT_ORDER, RECORD_DEFECTS } from "./records.ts";
import { SECURITY_DEFECT_ORDER, SECURITY_DEFECTS } from "./security.ts";

export const DEFECTS: Readonly<
  typeof CORE_DEFECTS &
    typeof COMPOSITION_DEFECTS &
    typeof QUERY_DEFECTS &
    typeof RECORD_DEFECTS &
    typeof CATALOG_DEFECTS &
    typeof SECURITY_DEFECTS &
    typeof FRESHNESS_DEFECTS
> = {
  ...CORE_DEFECTS,
  ...COMPOSITION_DEFECTS,
  ...QUERY_DEFECTS,
  ...RECORD_DEFECTS,
  ...CATALOG_DEFECTS,
  ...SECURITY_DEFECTS,
  ...FRESHNESS_DEFECTS,
};

/** Every defect's name in the table's order: the families as listed, each in its own order. */
export const DEFECT_ORDER: readonly DefectName[] = [
  ...CORE_DEFECT_ORDER,
  ...COMPOSITION_DEFECT_ORDER,
  ...QUERY_DEFECT_ORDER,
  ...RECORD_DEFECT_ORDER,
  ...CATALOG_DEFECT_ORDER,
  ...SECURITY_DEFECT_ORDER,
  ...FRESHNESS_DEFECT_ORDER,
];

export type DefectName = keyof typeof DEFECTS;

export function isDefectName(value: string): value is DefectName {
  return Object.hasOwn(DEFECTS, value);
}
