/** Cached reads, under the cached-reads shape: how stale a read gets, and whether its bypass works. */
export const FRESHNESS_DEFECTS = {
  /** The declared bypass header is accepted and ignored: the cache answers anyway. */
  BYPASS_IGNORED: "a read's declared cache bypass is ignored and the cache answers",
  /** The cache keeps a copy past the staleness the read declares. */
  STALE_PAST_BOUND: "a cached read stays stale past the staleness bound it declares",
};

/** The family's names in the table's order: what the matrix and the docs list, not the record's key order. */
export const FRESHNESS_DEFECT_ORDER: readonly (keyof typeof FRESHNESS_DEFECTS)[] = [
  "STALE_PAST_BOUND",
  "BYPASS_IGNORED",
];
