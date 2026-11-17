import { describe, expect, it } from "vitest";

import { BASE, exchange, finding, operation, reportOf, scopeOf } from "./__fixtures__/report.ts";
import type { ReportInput } from "./input.ts";
import { renderJson } from "./json.ts";

// Every nested part a run can fill, each with every optional field set.
const PARTS: Partial<ReportInput> = {
  baseline: { fixed: [{ check: "sort.order-is-applied", entity: "row", operationId: "row.list", reason: "t" }] },
  checkNotes: [{ check: "world.seed", entity: "row", note: "n" }],
  checksOutOfScope: [{ check: "sort.order-is-applied", entity: "row" }],
  checksSkipped: [{ check: "sort.order-is-applied", entity: "row", needs: "x" }],
  checksSuppressed: [{ because: "b", check: "sort.order-is-applied", entity: "row" }],
  fenced: {
    failRun: true,
    requests: [{ method: "GET", operationId: "row.list", phase: "load", reason: "no", url: `${BASE}/v1/rows` }],
  },
  findings: [finding({ fixture: "a.png", known: { reason: "t" }, operations: ["row.list"], origin: "cdn" })],
  inconclusive: [{ check: "sort.order-is-applied", entity: "row", operations: ["row.list"], reason: "r" }],
  network: { attempts: 1, incomplete: false, kind: "reset", url: BASE, waitedMs: 0 },
  profileExclusions: [{ entity: "row", operationId: "row.list", reason: "r" }],
  scope: scopeOf({
    excluded: [{ operationId: "row.list", reason: "r" }],
    operations: [
      operation({
        evidence: { call: 1, observation: { absent: true, path: "$", seq: 2, value: "v" } },
        origin: "cdn",
        sufficiency: "verified",
        tier: "verified",
        why: "w",
      }),
      operation({ evidence: { call: 1, observation: { seq: 2, status: 404 } } }),
      operation({ evidence: { call: 1 } }),
    ],
    support: [
      { calls: 2, firstFailure: { requestId: "q", status: 500 }, non2xx: 1, operationId: "row.list", origin: "cdn" },
      { calls: 1, non2xx: 0, operationId: "row.get" },
    ],
  }),
  teardown: {
    failed: [{ entity: "row", id: "1", principal: "p", reason: "r" }],
    records: [{ entity: "row", id: "1", inferred: true, kept: "k", principal: "p", removed: false }],
    removed: 0,
    unidentified: [{ entity: "row", method: "POST", operationId: "row.create", seq: 1, status: 201, url: BASE }],
    unsupported: ["row"],
    verifyHookErrors: ["e"],
  },
};

const TRANSCRIPT = [exchange({ check: "sort.order-is-applied", durationMs: 7 })];

// The same value with every plain object's keys in the reverse of the order they were written in.
function reversedKeys<T>(value: T): T {
  if (value === null || value === undefined) return value;

  // An array maps to an array of the same items' type.
  if (Array.isArray(value)) return value.map(reversedKeys) /* the same items, reordered within */ as T;

  if (Object.getPrototypeOf(value) !== Object.prototype) return value;
  const entries = Object.entries(value).toReversed();

  return Object.fromEntries(entries.map(([key, inner]) => [key, reversedKeys(inner)])) /* the same fields */ as T;
}

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

// The key orders of a JSON document, per path, an array's items under `[]`.
function keyOrders(value: Json, path = "", out: Record<string, string[][]> = {}): Record<string, string[][]> {
  if (Array.isArray(value)) {
    for (const item of value) keyOrders(item, `${path}[]`, out);
  } else if (value instanceof Object) {
    const keys = Object.keys(value);
    const seen = (out[path] ??= []);

    if (!seen.some((known) => known.join() === keys.join())) seen.push(keys);

    for (const [key, inner] of Object.entries(value)) keyOrders(inner, `${path}.${key}`, out);
  }

  return out;
}

// What a reader of `report.json` reads in each nested part, field by field.
const READER_ORDER = {
  ".baseline.fixed[]": [["check", "reason", "entity", "operationId"]],
  ".checksOutOfScope[]": [["check", "entity"]],
  ".checksSkipped[]": [["check", "entity", "needs"]],
  ".checksSuppressed[]": [["because", "check", "entity"]],
  ".costByCheck[]": [["check", "ms", "requests"]],
  ".coverage": [["neverApplied", "partial"]],
  ".fenced": [["failRun", "requests"]],
  ".fenced.requests[]": [["method", "phase", "reason", "url", "operationId"]],
  ".inconclusive[]": [["check", "entity", "reason", "operations"]],
  ".latency": [["max", "p50", "p95", "slowest"]],
  ".latency.slowest": [["method", "path"]],
  ".network": [["attempts", "incomplete", "kind", "url", "waitedMs"]],
  ".observed[]": [["check", "entity", "note"]],
  ".outcome": [["exitCode", "reason", "result"]],
  ".profileExclusions[]": [["entity", "operationId", "reason"]],
  ".scope": [["excluded", "mode", "operations", "originsSkipped", "requested", "support"]],
  ".scope.excluded[]": [["operationId", "reason"]],
  ".scope.operations[]": [
    [
      "checks",
      "entity",
      "findings",
      "operationId",
      "reason",
      "status",
      "evidence",
      "sufficiency",
      "tier",
      "why",
      "origin",
    ],
    ["checks", "entity", "findings", "operationId", "reason", "status", "evidence"],
  ],
  ".scope.operations[].checks": [["failed", "gaps", "inconclusive", "passed", "suppressed"]],
  ".scope.operations[].evidence": [["call", "observation"], ["call"]],
  ".scope.operations[].evidence.observation": [
    ["absent", "path", "seq", "value"],
    ["seq", "status"],
  ],
  ".scope.requested": [["only", "ops"]],
  ".scope.support[]": [
    ["calls", "non2xx", "operationId", "firstFailure", "origin"],
    ["calls", "non2xx", "operationId"],
  ],
  ".scope.support[].firstFailure": [["requestId", "status"]],
  ".teardown": [["failed", "records", "removed", "unidentified", "unsupported", "verifyHookErrors"]],
  ".teardown.failed[]": [["entity", "id", "principal", "reason"]],
  ".teardown.records[]": [["entity", "id", "principal", "removed", "inferred", "kept"]],
  ".teardown.unidentified[]": [["entity", "method", "operationId", "seq", "status", "url"]],
} satisfies Record<string, string[][]>;

describe("the JSON report's nested parts", () => {
  it("state their fields in one order, whatever order the run wrote them in", () => {
    expect(renderJson(reportOf(reversedKeys(PARTS), TRANSCRIPT))).toBe(renderJson(reportOf(PARTS, TRANSCRIPT)));
  });

  it("state their fields in the order a reader reads them", () => {
    const orders = keyOrders(JSON.parse(renderJson(reportOf(PARTS, TRANSCRIPT))) /* renderJson writes JSON */ as Json);
    expect(Object.fromEntries(Object.keys(READER_ORDER).map((path) => [path, orders[path]]))).toStrictEqual(
      READER_ORDER,
    );
  });
});
