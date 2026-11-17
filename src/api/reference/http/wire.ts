/** A request and its answer as the reference sees them, whichever transport carried them. */

import { sortedJson } from "../../spec/sorted-json.ts";
import type { Row } from "../cell.ts";
import type { Json as SpecJson } from "../spec/types.ts";

/** A JSON object as the reference reads and answers it. */
export type Json = Row;

export type ReferenceRequest = {
  /** Upper-cased. */
  method: string;
  /** Below the base path, when the shape mounts one. */
  url: URL;
  /** Lower-cased names. */
  headers: Readonly<Record<string, string>>;
  /** The body as text; read once, however often asked. */
  text: () => Promise<string>;
};

export type ReferenceResponse = {
  status: number;
  headers: Record<string, string>;
  body: string;
};

export function respond(status: number, body: unknown, extraHeaders: Record<string, string> = {}): ReferenceResponse {
  return answer(status, sortedJson(body), extraHeaders);
}

/**
 * A body whose key order is part of what it says, as a document's paths are its author's order:
 * serialized as built, by code that orders it through an explicit list.
 */
export function respondAsBuilt(status: number, body: SpecJson): ReferenceResponse {
  return answer(status, JSON.stringify(body), {});
}

function answer(status: number, payload: string, extraHeaders: Record<string, string>): ReferenceResponse {
  return {
    body: payload,
    headers: {
      "content-length": String(Buffer.byteLength(payload)),
      "content-type": "application/json",
      ...extraHeaders,
    },
    status,
  };
}

/** A 204: nothing in the body, so no content type either. */
export function noContent(): ReferenceResponse {
  return { body: "", headers: {}, status: 204 };
}

/** What a request carries beside its method and URL: its headers, and how to read its body. */
export type ReferenceInit = {
  headers: Readonly<Record<string, string>>;
  read: () => Promise<string>;
};

/** A request whose body is read at most once. */
export function referenceRequest(method: string, url: URL, { headers, read }: ReferenceInit): ReferenceRequest {
  let body: Promise<string> | undefined;

  return { headers, method: method.toUpperCase(), text: () => (body ??= read()), url };
}
