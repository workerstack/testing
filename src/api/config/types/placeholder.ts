import { entriesByName } from "./entries-by-name.ts";

// The `{name}` placeholder grammar every step, recipe and scenario shares. A name is letters,
// digits and `_`, with a single `-` between them, as path parameters and the saveAs names copied
// from them (`user-id`) are written. The three patterns below spell that one name alike.

/** Every `{name}` in a text. */
export const PLACEHOLDER: RegExp = /\{([A-Za-z0-9_]+(?:-[A-Za-z0-9_]+)*)\}/g;

/** A text that is nothing but one `{name}`. */
export const WHOLE_PLACEHOLDER: RegExp = /^\{([A-Za-z0-9_]+(?:-[A-Za-z0-9_]+)*)\}$/;

/** Every `{principal.<key>}` in a text: the principal's identity, filled apart from the flow scope. */
export const PRINCIPAL_PLACEHOLDER: RegExp = /\{principal\.([A-Za-z0-9_]+(?:-[A-Za-z0-9_]+)*)\}/g;

/** Bytes are a file's content, not text to fill: walking them would turn an upload into JSON. */
export function isBytes(value: unknown): value is ArrayBuffer | ArrayBufferView | Blob {
  return value instanceof ArrayBuffer || ArrayBuffer.isView(value) || value instanceof Blob;
}

/** Every `{name}` in the text of a value, deep through arrays and objects, in order; bytes hold none. */
export function placeholderNames(value: unknown): string[] {
  if (typeof value === "string") return [...value.matchAll(PLACEHOLDER)].map(([, name]) => name as string);

  if (Array.isArray(value)) return value.flatMap(placeholderNames);

  if (isBytes(value) || value === null || typeof value !== "object") return [];

  return Object.values(value).flatMap(placeholderNames);
}

/** The entries of one `bind` or `saveAs` in the order they can be filled, and those that never can. */
export type BindOrder = {
  /** Names in dependency order: each follows every sibling its template reads. */
  order: string[];
  /** The same entries as `[name, template]`, in that order. */
  pairs: [string, string][];
  /** Names that read themselves, read each other in a cycle, or read one that does. */
  cyclic: string[];
};

/**
 * Orders the entries of one `bind` or `saveAs`. An entry may read any sibling, so the order never
 * depends on how the keys were written: a sibling is filled before the entries that read it, and
 * entries that wait on nothing new go by name. An entry reading its own name reads the scope as it
 * stood before (a rebind such as `id: "{id}"`), so it waits on no sibling. A cycle among siblings
 * has no order and is returned in `cyclic`.
 */
export function bindOrder(entries: Readonly<Record<string, string>>): BindOrder {
  let pending = entriesByName(entries).map(([name, template]) => ({
    name,
    reads: placeholderNames(template).filter((read) => read !== name && Object.hasOwn(entries, read)),
    template,
  }));

  const order: string[] = [];
  const pairs: [string, string][] = [];

  while (pending.length > 0) {
    const ready = pending.filter((entry) => entry.reads.every((read) => order.includes(read)));

    if (ready.length === 0) return { cyclic: pending.map((entry) => entry.name), order, pairs };
    order.push(...ready.map((entry) => entry.name));
    pairs.push(...ready.map((entry): [string, string] => [entry.name, entry.template]));
    pending = pending.filter((entry) => !order.includes(entry.name));
  }

  return { cyclic: [], order, pairs };
}
