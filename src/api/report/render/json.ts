import { describeRequestBody, type Exchange } from "../../runtime/exchange.ts";
import { EXIT, runVerdict } from "../../runtime/exit.ts";
import type { Finding } from "../../runtime/finding.ts";
import { presentHeader } from "../../runtime/headers.ts";
import type { Redactor } from "../../security/redact.ts";
import { inOrder } from "../../spec/in-order.ts";
import { coverageByCheck } from "./coverage.ts";
import type { ReportInput } from "./input.ts";
import {
  BASELINE_ENTRY_ORDER,
  COST_ORDER,
  COVERAGE_ORDER,
  EXCLUSION_ORDER,
  FENCED_ORDER,
  FENCED_REQUEST_ORDER,
  INCONCLUSIVE_ORDER,
  NETWORK_ORDER,
  NOTE_ORDER,
  OUTCOME_ORDER,
  OUT_OF_SCOPE_ORDER,
  PARTIAL_ORDER,
  SKIPPED_ORDER,
  SUPPRESSED_ORDER,
  latencyJson,
  rowsInOrder,
  scopeJson,
  teardownJson,
} from "./json-parts.ts";
import { costByCheck, latency, utf8Total } from "./traffic.ts";
import { byVerdict } from "./verdicts.ts";

/** An exchange's fields in the order `report.json` states them. */
const EVIDENCE_ORDER = [
  "at",
  "durationMs",
  "method",
  "requestBody",
  "requestBytes",
  "requestId",
  "responseBody",
  "responseBytes",
  "status",
  "url",
] as const;

/** A finding's fields in the order `report.json` states them. */
const FINDING_ORDER = [
  "check",
  "detail",
  "entity",
  "origin",
  "fixture",
  "operations",
  "known",
  "evidence",
  "summary",
  "verdict",
] as const;

/** The run's circumstances in the order `report.json` states them. */
const CONTEXT_ORDER = [
  "generatedAt",
  "requests",
  "network",
  "interrupted",
  "baseline",
  "targetVersion",
  "fenced",
] as const;

function evidenceJson(exchange: Exchange, redactor: Redactor): Record<string, unknown> {
  // A secret the response issues may sit in the request or URL rendered first.
  redactor.learn(exchange.responseBody);

  return inOrder(EVIDENCE_ORDER, {
    at: new Date(exchange.at).toISOString(),
    durationMs: exchange.durationMs,
    method: exchange.method,
    requestBody: redactor.body(
      describeRequestBody(exchange.requestBody),
      presentHeader(exchange.requestHeaders, "content-type") ?? "",
    ),
    requestBytes: exchange.requestBytes,
    requestId: exchange.requestId,
    responseBody: redactor.body(exchange.responseBody, presentHeader(exchange.responseHeaders, "content-type") ?? ""),
    responseBytes: exchange.responseBytes,
    status: exchange.status,
    url: redactor.url(exchange.url),
  });
}

function findingJson(finding: Finding, redactor: Redactor): Record<string, unknown> {
  return inOrder(FINDING_ORDER, {
    check: finding.check,
    detail: finding.detail,
    entity: finding.entity,
    ...(finding.origin === undefined ? {} : { origin: finding.origin }),
    ...(finding.fixture === undefined ? {} : { fixture: finding.fixture }),
    ...(finding.operations === undefined ? {} : { operations: finding.operations }),
    ...(finding.known === undefined ? {} : { known: finding.known }),
    evidence: finding.evidence.map((exchange) => evidenceJson(exchange, redactor)),
    summary: finding.summary,
    verdict: finding.verdict,
  });
}

/** The verdict fields in the order `report.json` states them. */
const RUN_ORDER = [
  "backend",
  "outcome",
  "checksRun",
  "checksSkipped",
  "checksSuppressed",
  "inconclusive",
  "profile",
  "profileExclusions",
  "scope",
  "checksOutOfScope",
  "durationMs",
  "entitiesTested",
  "teardown",
] as const;

/** The cost and tally fields in the order `report.json` states them. */
const TALLY_ORDER = [
  "requestBytes",
  "responseBytes",
  "latency",
  "costByCheck",
  "observed",
  "summary",
  "coverage",
] as const;

/** The verdict, and what the run did and did not check. */
function runJson(input: ReportInput): Record<string, unknown> {
  const { outcome, reason } = runVerdict(input);

  return inOrder(RUN_ORDER, {
    backend: input.baseUrl,
    checksRun: input.checksRun,
    checksSkipped: rowsInOrder(SKIPPED_ORDER, input.checksSkipped ?? []),
    checksSuppressed: rowsInOrder(SUPPRESSED_ORDER, input.checksSuppressed ?? []),
    inconclusive: rowsInOrder(INCONCLUSIVE_ORDER, input.inconclusive ?? []),
    // The same verdict the process exit code states.
    outcome: inOrder(OUTCOME_ORDER, { exitCode: EXIT[outcome], reason, result: outcome }),
    profile: input.profile ?? "full",
    profileExclusions: rowsInOrder(EXCLUSION_ORDER, input.profileExclusions ?? []),
    ...(input.scope === undefined ? {} : { scope: scopeJson(input.scope) }),
    checksOutOfScope: rowsInOrder(OUT_OF_SCOPE_ORDER, input.checksOutOfScope ?? []),
    durationMs: input.durationMs,
    entitiesTested: input.entitiesTested,
    ...(input.teardown === undefined || input.teardown === null ? {} : { teardown: teardownJson(input.teardown) }),
  });
}

/** When it ran, and the circumstances a reader needs to trust it: network, interruption, baseline, build, fence. */
function contextJson(input: ReportInput, redactor: Redactor): Record<string, unknown> {
  return inOrder(CONTEXT_ORDER, {
    generatedAt: input.startedAt.toISOString(),
    requests: input.client.transcript.length,
    ...(input.network === undefined ? {} : { network: inOrder(NETWORK_ORDER, input.network) }),
    ...(input.interrupted === true ? { interrupted: true } : {}),
    ...(input.baseline === undefined
      ? {}
      : { baseline: { fixed: rowsInOrder(BASELINE_ENTRY_ORDER, input.baseline.fixed) } }),
    ...(input.targetVersion === undefined ? {} : { targetVersion: input.targetVersion }),
    ...(input.fenced === undefined
      ? {}
      : {
          fenced: inOrder(FENCED_ORDER, {
            failRun: input.fenced.failRun,
            requests: input.fenced.requests.map((request) =>
              inOrder(FENCED_REQUEST_ORDER, { ...request, url: redactor.url(request.url) }),
            ),
          }),
        }),
  });
}

/** What the run cost and observed, the findings per severity, and the coverage it fell short of. */
function tallyJson(input: ReportInput): Record<string, unknown> {
  const coverage = coverageByCheck(input);

  return inOrder(TALLY_ORDER, {
    costByCheck: rowsInOrder(COST_ORDER, costByCheck(input)),
    coverage: inOrder(COVERAGE_ORDER, {
      neverApplied: coverage.never.map((row) => row.check),
      partial: coverage.partialSkip.map((row) =>
        inOrder(PARTIAL_ORDER, { check: row.check, ran: row.ran, skipped: row.skipped }),
      ),
    }),
    latency: latencyJson(latency(input.client.transcript)),
    observed: rowsInOrder(NOTE_ORDER, input.checkNotes ?? []),
    requestBytes: utf8Total(input.client.transcript, "request"),
    responseBytes: utf8Total(input.client.transcript, "response"),
    summary: Object.fromEntries(byVerdict(input.findings).map(([verdict, group]) => [verdict, group.length])),
  });
}

/**
 * The shape version of `report.json` and `matrix.json`. It rises only on a breaking change to a
 * file's shape; an added field is not one.
 */
export const REPORT_SCHEMA_VERSION = 1;

/** Machine-readable output for CI gating and diffing between runs. */
export function renderJson(input: ReportInput): string {
  const redactor = input.client.redactor;

  return `${JSON.stringify(
    {
      schemaVersion: REPORT_SCHEMA_VERSION,
      ...runJson(input),
      findings: input.findings.map((finding) => findingJson(finding, redactor)),
      ...contextJson(input, redactor),
      ...tallyJson(input),
    },
    null,
    2,
  )}\n`;
}
