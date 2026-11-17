/** What the declared query catalog, ids, tenancy and side effects promise and the backend breaks. */
export const CATALOG_DEFECTS = {
  /**
   * Under the client-ids shape: the create stores the table under an id of the server's own,
   * ignoring the one the client chose, and still answers only an acknowledgment.
   */
  CLIENT_ID_IGNORED: "a create ignores the client-chosen id and stores the record under another",
  /** Under the client-ids shape: a create with an id the tenant already holds overwrites that record. */
  CLIENT_ID_OVERWRITES: "a create with an existing id silently overwrites that record",
  /** `contains` matches the serialized array as text, so an element also matches its superstrings. */
  CONTAINS_MATCHES_SUBSTRING: "contains matches any element containing the value, not the element itself",
  /**
   * Create crashes on input outside ASCII. Only some records carry such input, so most of a
   * cohort is created fine and one variant fails with a 500.
   */
  CREATE_500_ON_NON_ASCII: "create fails with a server error when a string holds non-ASCII text",
  /** Update and delete find the record by id alone, so another tenant can change or remove it. */
  CROSS_TENANT_WRITE: "update and delete reach records belonging to another tenant",
  /** Without an explicit order the listing does not use the documented default order. */
  DEFAULT_ORDER_IGNORED: "the listing ignores the documented default order",
  /** The alias table maps `ne` to the wrong operator: it behaves as `eq`. */
  FILTER_ALIAS_MISMAPPED: "the ne alias is mapped to eq instead of neq",
  /** A filter with more terms than `maxFilterConditions` is evaluated instead of rejected. */
  FILTER_CONDITION_CAP_IGNORED: "a filter over the documented condition cap is accepted",
  /** Every pair and triple of axes composes; all four together drop the filter. */
  FILTER_DROPPED_WHEN_SORTED_SEARCHED_AND_SELECTED:
    "a filter stops being applied once a sort, a search and a select are requested together",
  /** An `in()` list longer than `maxInValues` is evaluated instead of rejected. */
  FILTER_IN_CAP_IGNORED: "an in() list over the documented maximum is accepted",
  /** `lte` is compiled as `lt`. */
  FILTER_LTE_IS_LT: "lte is implemented as lt",
  /** `lt` is compiled as `lte`, so a boundary value is both below and equal to itself. */
  FILTER_LT_IS_LTE: "lt is implemented as lte",
  /**
   * A builder that keeps one "current joiner": once a nested group sets it, the enclosing group
   * joins its remaining terms with the nested group's combinator. Flat and()/or() are unaffected.
   */
  FILTER_NESTED_COMBINATOR_LEAKS: "a nested group's combinator replaces the enclosing group's",
  /** `nin.(a,b)` only excludes the first listed value. */
  FILTER_NIN_FIRST_ONLY: "nin() excludes only the first listed value",
  /** A child route accepts another tenant's parent id under the caller's own root. */
  FOREIGN_PARENT_ACCEPTED:
    "a child collection is reachable through another tenant's parent placed under one's own root",
  /**
   * A row holding `testing-payload-probe` — the ASCII control `payload.string-survives` writes to a fresh
   * record before any case of its catalog — is hidden from everyone, its creator included: no
   * read or list serves it, and its delete answers 200 and keeps it. Only teardown's account of
   * what its creator never saw can name it.
   */
  HIDDEN_FROM_CREATOR: "a row holding a given value is never served, not even to its creator, and outlives its delete",
  /** A replayed idempotency key is answered with the original record, but a second row is written too. */
  IDEMPOTENT_REPLAY_INSERTS: "a replayed create returns the original record and still inserts another",
  /** A nested select returns the whole related record rather than the requested fields. */
  NESTED_SELECT_IGNORED: "a nested select returns every field of the relation",
  /** The sort is dropped once a sparse fieldset joins it. */
  ORDER_DROPPED_WHEN_SELECTED: "a sort stops being applied once a select is also requested",
  /** A page number past the end returns the last page again instead of an empty page. */
  PAGE_PAST_END_REPEATS: "a page past the end of the collection repeats the last page",
  /** The first listing of each entity is refused with 429, far inside the rate x-rate-limit declares. */
  RATE_LIMIT_STRICTER_THAN_DECLARED: "a listing answers 429 well inside the rate x-rate-limit declares",
  /** The viewer may update records the member may not. */
  ROLE_WRITE_INVERTED: "a lower-ranked role can update a record a higher-ranked same-tenant role cannot",
  /** Search compares case-sensitively although the document declares it insensitive. */
  SEARCH_CASE_SENSITIVE: "search is case-sensitive despite searchCase: insensitive",
  /** A free-text search is dropped once a sparse fieldset joins it. */
  SEARCH_DROPPED_WHEN_SELECTED: "a search stops being applied once a select is also requested",
  /** A free-text search is dropped once a sort joins it. */
  SEARCH_DROPPED_WHEN_SORTED: "a search stops being applied once a sort is also requested",
  /** An empty `q` matches nothing although the document declares it matches everything. */
  SEARCH_EMPTY_MATCHES_NONE: "an empty search matches nothing despite searchEmpty: match-all",
  /** A search mode the document declares is rejected. */
  SEARCH_MODE_REJECTED: "a declared search mode is rejected",
  /** Only the first whitespace-separated search token is applied. */
  SEARCH_ONLY_FIRST_TOKEN: "only the first search token is applied",
  /** An unknown select field is dropped although the document says it is rejected. */
  SELECT_UNKNOWN_IGNORED: "an unknown select field is ignored despite select.unknown: reject",
  /** A write whose side effect is declared with x-wait never produces it. */
  SIDE_EFFECT_NEVER_ARRIVES: "a side effect declared with x-wait never arrives",
  /** `nullsfirst` / `nullslast` are parsed and ignored. */
  SORT_NULLS_MODIFIER_IGNORED: "nullsfirst and nullslast modifiers are ignored",
  /** An order on a field that does not exist is dropped instead of rejected. */
  SORT_UNKNOWN_FIELD_IGNORED: "an unknown sort field is silently ignored rather than rejected",
  /** The document lists an operator for a field that the backend rejects. */
  SPEC_OVERCLAIMS_FILTER_OP: "x-query declares a filter operator on a field that the backend rejects",
  /** Ties are broken by another field than the declared `stableTiebreak`. */
  TIEBREAK_NOT_APPLIED: "ties are ordered by another field than the documented tiebreak",
  /** A query parameter the listing does not know empties the result instead of being ignored. */
  UNKNOWN_PARAM_EMPTIES_LIST: "an unknown query parameter makes the listing return nothing",
} as const;

/** The family's names in the table's order: what the matrix and the docs list, not the record's key order. */
export const CATALOG_DEFECT_ORDER: readonly (keyof typeof CATALOG_DEFECTS)[] = [
  "FILTER_ALIAS_MISMAPPED",
  "FILTER_CONDITION_CAP_IGNORED",
  "FILTER_IN_CAP_IGNORED",
  "FILTER_LTE_IS_LT",
  "FILTER_LT_IS_LTE",
  "FILTER_NESTED_COMBINATOR_LEAKS",
  "FILTER_NIN_FIRST_ONLY",
  "FILTER_DROPPED_WHEN_SORTED_SEARCHED_AND_SELECTED",
  "SEARCH_DROPPED_WHEN_SELECTED",
  "SEARCH_DROPPED_WHEN_SORTED",
  "ORDER_DROPPED_WHEN_SELECTED",
  "SEARCH_CASE_SENSITIVE",
  "SEARCH_EMPTY_MATCHES_NONE",
  "SEARCH_ONLY_FIRST_TOKEN",
  "SELECT_UNKNOWN_IGNORED",
  "SORT_NULLS_MODIFIER_IGNORED",
  "SORT_UNKNOWN_FIELD_IGNORED",
  "SPEC_OVERCLAIMS_FILTER_OP",
  "CONTAINS_MATCHES_SUBSTRING",
  "SEARCH_MODE_REJECTED",
  "NESTED_SELECT_IGNORED",
  "DEFAULT_ORDER_IGNORED",
  "CREATE_500_ON_NON_ASCII",
  "SIDE_EFFECT_NEVER_ARRIVES",
  "RATE_LIMIT_STRICTER_THAN_DECLARED",
  "CLIENT_ID_IGNORED",
  "CLIENT_ID_OVERWRITES",
  "CROSS_TENANT_WRITE",
  "FOREIGN_PARENT_ACCEPTED",
  "PAGE_PAST_END_REPEATS",
  "UNKNOWN_PARAM_EMPTIES_LIST",
  "ROLE_WRITE_INVERTED",
  "TIEBREAK_NOT_APPLIED",
  "IDEMPOTENT_REPLAY_INSERTS",
  "HIDDEN_FROM_CREATOR",
];
