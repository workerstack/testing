/** A test server's view of a request body: `{}` when it sent none, and `undefined` when it does not parse, which the server answers 400. */
export function jsonBody(raw: string): Record<string, unknown> | undefined {
  if (raw === "") return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/**
 * JSON a test reads back to assert on. Each test indexes into it as the shape it expects, so it is loosely typed on
 * purpose, as `JSON.parse` was before ts-reset typed it `unknown`.
 */
export function readBack(text: string): any {
  return JSON.parse(text);
}
