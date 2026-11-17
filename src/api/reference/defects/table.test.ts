import { describe, expect, it } from "vitest";

import { CATALOG_DEFECT_ORDER, CATALOG_DEFECTS } from "./catalog.ts";
import { COMPOSITION_DEFECT_ORDER, COMPOSITION_DEFECTS } from "./composition.ts";
import { CORE_DEFECT_ORDER, CORE_DEFECTS } from "./core.ts";
import { FRESHNESS_DEFECT_ORDER, FRESHNESS_DEFECTS } from "./freshness.ts";
import { QUERY_DEFECT_ORDER, QUERY_DEFECTS } from "./query.ts";
import { RECORD_DEFECT_ORDER, RECORD_DEFECTS } from "./records.ts";
import { SECURITY_DEFECT_ORDER, SECURITY_DEFECTS } from "./security.ts";
import { DEFECT_ORDER, DEFECTS, isDefectName } from "./table.ts";

// The families as the table lists them: each record beside the list of its names in order.
const FAMILIES: readonly (readonly [Record<string, string>, readonly string[]])[] = [
  [CORE_DEFECTS, CORE_DEFECT_ORDER],
  [COMPOSITION_DEFECTS, COMPOSITION_DEFECT_ORDER],
  [QUERY_DEFECTS, QUERY_DEFECT_ORDER],
  [RECORD_DEFECTS, RECORD_DEFECT_ORDER],
  [CATALOG_DEFECTS, CATALOG_DEFECT_ORDER],
  [SECURITY_DEFECTS, SECURITY_DEFECT_ORDER],
  [FRESHNESS_DEFECTS, FRESHNESS_DEFECT_ORDER],
];

describe("DEFECT_ORDER", () => {
  it("lists the families in order, so every reader sees one stable name order", () => {
    expect(DEFECT_ORDER).toStrictEqual(FAMILIES.flatMap(([, order]) => order));
    expect(DEFECT_ORDER).toHaveLength(139);
    expect(DEFECTS.UNSTABLE_SORT).toBe(CORE_DEFECTS.UNSTABLE_SORT);
  });

  it("holds exactly each family's names, each once, no more and no fewer", () => {
    for (const [record, order] of FAMILIES) expect([...order].toSorted()).toStrictEqual(Object.keys(record).toSorted());
    expect([...DEFECT_ORDER].toSorted()).toStrictEqual(Object.keys(DEFECTS).toSorted());
  });
});

describe("DEFECTS", () => {
  it("names no defect twice across the families", () => {
    const total = FAMILIES.reduce((sum, [record]) => sum + Object.keys(record).length, 0);
    expect(total).toBe(Object.keys(DEFECTS).length);
  });
});

describe("isDefectName", () => {
  it("accepts every defect's name", () => {
    expect(Object.keys(DEFECTS).every(isDefectName)).toBe(true);
  });

  it("refuses anything else, an object's own inherited keys included", () => {
    for (const name of ["", "unstable_sort", " UNSTABLE_SORT", "NOPE", "constructor", "toString", "__proto__"])
      expect(isDefectName(name)).toBe(false);
  });
});
