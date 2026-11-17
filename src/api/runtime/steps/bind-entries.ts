import { bindOrder } from "../../config/types/placeholder.ts";

/**
 * The entries of a step's `bind` or `saveAs` in the order they can be filled: each after the
 * siblings it reads, whatever order the config wrote them in. A cycle among siblings has no value
 * to start from, so it stops the run with the names involved; a self-read reads the scope as it stood.
 */
export function bindEntries(entries: Readonly<Record<string, string>> | undefined, what: string): [string, string][] {
  const { cyclic, pairs } = bindOrder(entries ?? {});

  if (cyclic.length > 0)
    throw new Error(`testing api: ${what} entries read each other in a cycle: ${cyclic.join(", ")}`);

  return pairs;
}
