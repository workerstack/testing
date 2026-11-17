import type { PassEvidence } from "../../runtime/grades.ts";
import type { OperationCoverage, ScopeReport, SupportUse } from "../../runtime/scope/types.ts";
import type { TeardownReport } from "../../runtime/teardown/types.ts";
import { inOrder } from "../../spec/in-order.ts";
import type { Latency } from "./traffic.ts";

/**
 * The fields of each part `report.json` nests, in the order it states them. A part is built wherever
 * the run learns it, by a literal, a spread or a later assignment, so its order is set here, where it is
 * written, and never by how its builder wrote it.
 */

export const OUTCOME_ORDER = ["exitCode", "reason", "result"] as const;
export const SKIPPED_ORDER = ["check", "entity", "needs"] as const;
export const SUPPRESSED_ORDER = ["because", "check", "entity"] as const;
export const OUT_OF_SCOPE_ORDER = ["check", "entity"] as const;
export const INCONCLUSIVE_ORDER = ["check", "entity", "reason", "operations"] as const;
export const EXCLUSION_ORDER = ["entity", "operationId", "reason"] as const;
export const NOTE_ORDER = ["check", "entity", "note"] as const;
const SCOPE_ORDER = ["excluded", "mode", "operations", "originsSkipped", "requested", "support"] as const;
const REQUESTED_ORDER = ["only", "ops"] as const;
const SCOPE_EXCLUDED_ORDER = ["operationId", "reason"] as const;

const OPERATION_ORDER = [
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
] as const;

const CHECKS_ORDER = ["failed", "gaps", "inconclusive", "passed", "suppressed"] as const;
const PASS_EVIDENCE_ORDER = ["call", "observation"] as const;
const READ_OBSERVATION_ORDER = ["absent", "path", "seq", "value"] as const;
const STATUS_OBSERVATION_ORDER = ["seq", "status"] as const;
const SUPPORT_ORDER = ["calls", "non2xx", "operationId", "firstFailure", "origin"] as const;
const FIRST_FAILURE_ORDER = ["requestId", "status"] as const;
const TEARDOWN_ORDER = ["failed", "records", "removed", "unidentified", "unsupported", "verifyHookErrors"] as const;
const LEFTOVER_ORDER = ["entity", "id", "principal", "reason"] as const;
const RECORD_ORDER = ["entity", "id", "principal", "removed", "inferred", "kept"] as const;
const UNIDENTIFIED_ORDER = ["entity", "method", "operationId", "seq", "status", "url"] as const;
export const NETWORK_ORDER = ["attempts", "incomplete", "kind", "url", "waitedMs"] as const;
export const BASELINE_ENTRY_ORDER = ["check", "reason", "entity", "operationId"] as const;
export const FENCED_ORDER = ["failRun", "requests"] as const;
export const FENCED_REQUEST_ORDER = ["method", "phase", "reason", "url", "operationId"] as const;
const LATENCY_ORDER = ["max", "p50", "p95", "slowest"] as const;
const SLOWEST_ORDER = ["method", "path"] as const;
export const COST_ORDER = ["check", "ms", "requests"] as const;
export const COVERAGE_ORDER = ["neverApplied", "partial"] as const;
export const PARTIAL_ORDER = ["check", "ran", "skipped"] as const;

/** Each row of `rows` with its fields in `order`. */
export function rowsInOrder<T extends object>(order: readonly (keyof T)[], rows: readonly T[]): T[] {
  return rows.map((row) => inOrder(order, row));
}

function passEvidenceJson(evidence: PassEvidence): PassEvidence {
  const { observation } = evidence;

  return inOrder(PASS_EVIDENCE_ORDER, {
    ...evidence,
    ...(observation === undefined
      ? {}
      : {
          observation:
            "status" in observation
              ? inOrder(STATUS_OBSERVATION_ORDER, observation)
              : inOrder(READ_OBSERVATION_ORDER, observation),
        }),
  });
}

function operationJson(op: OperationCoverage): OperationCoverage {
  return inOrder(OPERATION_ORDER, {
    ...op,
    checks: inOrder(CHECKS_ORDER, op.checks),
    ...(op.evidence === undefined ? {} : { evidence: passEvidenceJson(op.evidence) }),
  });
}

function supportJson(use: SupportUse): SupportUse {
  return inOrder(SUPPORT_ORDER, {
    ...use,
    ...(use.firstFailure === undefined ? {} : { firstFailure: inOrder(FIRST_FAILURE_ORDER, use.firstFailure) }),
  });
}

export function scopeJson(scope: ScopeReport): ScopeReport {
  return inOrder(SCOPE_ORDER, {
    excluded: rowsInOrder(SCOPE_EXCLUDED_ORDER, scope.excluded),
    mode: scope.mode,
    operations: scope.operations.map(operationJson),
    originsSkipped: scope.originsSkipped,
    requested: inOrder(REQUESTED_ORDER, scope.requested),
    support: scope.support.map(supportJson),
  });
}

export function teardownJson(teardown: TeardownReport): TeardownReport {
  return inOrder(TEARDOWN_ORDER, {
    ...teardown,
    failed: rowsInOrder(LEFTOVER_ORDER, teardown.failed),
    records: rowsInOrder(RECORD_ORDER, teardown.records),
    unidentified: rowsInOrder(UNIDENTIFIED_ORDER, teardown.unidentified),
  });
}

export function latencyJson(timing: Latency | null): Latency | null {
  return timing === null
    ? null
    : inOrder(LATENCY_ORDER, { ...timing, slowest: inOrder(SLOWEST_ORDER, timing.slowest) });
}
