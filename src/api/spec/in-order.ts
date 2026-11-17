/**
 * `value` with its own keys in `order`: a reader's order, whatever order the literal that built it
 * took. A key the order leaves out is a mistake in the order, and throws; a listed key `value`
 * lacks is skipped, so an optional field has a place in the list.
 */
export function inOrder<T extends object>(order: readonly (keyof T)[], value: T): T {
  const unlisted = Reflect.ownKeys(value).filter((key) => !order.some((listed) => listed === key));

  if (unlisted.length > 0) throw new Error(`fields missing from the order: ${unlisted.map(String).join(", ")}`);
  const ordered = { ...value };

  for (const key of order) {
    if (!Object.hasOwn(value, key)) continue;
    Reflect.deleteProperty(ordered, key);
    ordered[key] = value[key];
  }

  return ordered;
}
