/** A progress snapshot as one logfmt line, one TSV row, or one JSON line. */

import { inOrder } from "../../spec/in-order.ts";
import { progressFields, type ProgressFields } from "./fields.ts";
import type { ProgressSnapshot } from "./types.ts";

/** The logfmt keys in the order a line reads: the instant first, then the columns as the TSV header lists them. */
export const LOGFMT_ORDER: readonly (keyof ProgressFields | "ts")[] = [
  "ts",
  "status",
  "done",
  "total",
  "phase",
  "entity",
  "check",
  "msg",
  "req",
  "find",
  "method",
  "path",
  "http",
  "req_id",
  "last_at",
  "last_ms",
  "req_b",
  "res_b",
  "idle_ms",
  "elapsed_ms",
];

function logfmt(pairs: Record<(typeof LOGFMT_ORDER)[number], string>): string {
  return LOGFMT_ORDER.map((key) => {
    const value = pairs[key];

    if (value !== "" && !/[\s="\\]/.test(value)) return `${key}=${value}`;

    return `${key}=${JSON.stringify(value)}`;
  }).join(" ");
}

/** A column's dash, the "no value" of the text formats, as JSON's `null`. */
function textOrNull(value: string): string | null {
  return value === "-" ? null : value;
}

function numberOrNull(value: string): number | null {
  return value === "-" ? null : Number(value);
}

export function formatProgressLine(snap: ProgressSnapshot, now: number = Date.now()): string {
  const f = progressFields(snap, now);

  return logfmt({ ...f, ts: new Date(now).toISOString() });
}

export function formatProgressTsv(snap: ProgressSnapshot, now: number = Date.now()): string {
  const f = progressFields(snap, now);

  return [
    now,
    f.status,
    f.done,
    f.total,
    f.phase,
    f.entity,
    f.check,
    f.msg,
    f.req,
    f.find,
    f.method,
    f.path,
    f.http,
    f.req_id,
    f.last_at,
    f.last_ms,
    f.req_b,
    f.res_b,
    f.idle_ms,
    f.elapsed_ms,
  ].join("\t");
}

/** The JSON line's fields in the order a reader tailing `progress.jsonl` sees them. */
const JSONL_ORDER = [
  "check",
  "done",
  "elapsed_ms",
  "entity",
  "find",
  "http",
  "idle_ms",
  "last_at",
  "last_ms",
  "method",
  "req_id",
  "req_b",
  "res_b",
  "msg",
  "path",
  "phase",
  "req",
  "status",
  "total",
  "ts",
  "ts_ms",
] as const;

export function formatProgressJsonl(snap: ProgressSnapshot, now: number = Date.now()): string {
  const f = progressFields(snap, now);
  const inflight = snap.inflight !== undefined;

  return JSON.stringify(
    inOrder(JSONL_ORDER, {
      check: textOrNull(f.check),
      done: snap.entityIndex ?? null,
      elapsed_ms: Number(f.elapsed_ms),
      entity: snap.entity ?? null,
      find: snap.findings,
      http: inflight ? null : (snap.last?.status ?? null),
      idle_ms: numberOrNull(f.idle_ms),
      last_at: textOrNull(f.last_at),
      last_ms: numberOrNull(f.last_ms),
      method: textOrNull(f.method),
      msg: textOrNull(f.msg),
      path: textOrNull(f.path),
      phase: snap.phase,
      req: snap.requests,
      req_b: numberOrNull(f.req_b),
      req_id: f.req_id === "" ? null : textOrNull(f.req_id),
      res_b: numberOrNull(f.res_b),
      status: f.status,
      total: snap.entityTotal ?? null,
      ts: new Date(now).toISOString(),
      ts_ms: now,
    }),
  );
}
