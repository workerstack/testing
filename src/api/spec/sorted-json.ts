import { isRecord } from "../config/types/raw.ts";

/** Whatever `JSON.stringify` takes. */
export type Writable = Parameters<typeof JSON.stringify>[0];

/**
 * `value` as JSON text with every object's keys by name, however the objects were built: text
 * a reader or a test compares must not hang on the order a literal wrote its keys in. Arrays
 * keep their order, which is the data's own.
 */
export function sortedJson(value: Writable, space?: number): string {
  return JSON.stringify(
    value,
    (_key: string, part: Writable): Writable => {
      if (!isRecord(part)) return part;
      const fields = new Map(Object.entries(part));

      return Object.fromEntries(
        Object.keys(part)
          .toSorted()
          .map((name) => [name, fields.get(name)]),
      );
    },
    space,
  );
}
