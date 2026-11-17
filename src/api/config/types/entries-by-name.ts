/**
 * The entries of a record by key, in UTF-16 code-unit order: the order a bare `.sort()` gives names,
 * the same on every host. A record's own key order is how its author wrote it, which no output may
 * depend on.
 */
export function entriesByName<V>(record: Readonly<Record<string, V>>): [string, V][] {
  return Object.entries(record).toSorted(([a], [b]) => Number(a > b) - Number(a < b));
}
