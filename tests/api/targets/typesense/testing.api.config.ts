import { defineConfig, env } from "../../../../src/api/index.ts";

// Typesense 30.2 (spec vendored from typesense/typesense-api-spec openapi.yml at 9963d6c, the last
// commit before the v30.2 release). Every operation takes the api_key_header scheme
// (X-TYPESENSE-API-KEY), one key per principal: alpha the bootstrap key, beta a key scoped to
// beta_.* collections, the viewer a scoped search key (target.ts).
//
// Scope: documents in a tenant's collection, API keys, and the collections a tenant can read.
// The search route is the documents' list; each row wraps its document, which `recordPath`
// points inside (`$.hits[*].document`). No alias the API tester knows names Typesense's filter parameter, so
// `x-query.params` does: the filter checks run through `filter_by`. Collection writes stay out of
// the document (`allow`): the run works inside the collections target.ts made.

// What alpha_books and beta_books index (target.ts): the document a create sends and a read answers.
const BOOK = {
  properties: {
    author: { type: "string" },
    id: { readOnly: true, type: "string" },
    in_stock: { type: "boolean" },
    rating: { type: "number" },
    title: { type: "string" },
    year: { maximum: 2147483647, minimum: -2147483648, type: "integer" },
  },
  required: ["title", "author", "year", "rating", "in_stock"],
  type: "object",
};

const json = (schema: unknown) => ({ content: { "application/json": { schema } } });

// A tenant's documents live in its own collection, which its key is scoped to.
const TENANT = { "x-tenant": "collectionName" };

const GRADED = [
  "indexDocument",
  "searchCollection",
  "getDocument",
  "updateDocument",
  "deleteDocument",
  "createKey",
  "getKeys",
  "getKey",
  "deleteKey",
  "getCollections",
  "getCollection",
];

export default defineConfig({
  allow: GRADED,
  baseUrl: env("TYPESENSE_URL"),
  ops: GRADED,
  overlay: {
    operations: {
      deleteDocument: { ...TENANT, responses: { "200": json(BOOK) } },
      getDocument: { ...TENANT, responses: { "200": json(BOOK) } },
      indexDocument: { ...TENANT, requestBody: json(BOOK), responses: { "201": json(BOOK) } },
      searchCollection: {
        ...TENANT,
        // The document declares one exploded `searchParameters` object; these are the members a
        // listing uses, as the query parameters it puts on the wire.
        parameters: [
          { in: "path", name: "collectionName", required: true, schema: { type: "string" } },
          { in: "query", name: "q", required: true, schema: { default: "*", type: "string" } },
          { in: "query", name: "query_by", required: true, schema: { default: "title,author", type: "string" } },
          { in: "query", name: "filter_by", schema: { type: "string" } },
          { in: "query", name: "sort_by", schema: { type: "string" } },
          { in: "query", name: "page", schema: { minimum: 1, type: "integer" } },
          { in: "query", name: "per_page", schema: { default: 10, maximum: 250, minimum: 0, type: "integer" } },
          // By default Typesense drops tokens until something matches; the run asks for every token.
          { in: "query", name: "drop_tokens_threshold", required: true, schema: { const: 0, type: "integer" } },
        ],
        "x-entity": { action: "list", name: "document", recordPath: "$.hits[*].document" },
        "x-query": {
          // Closed lists, as Typesense 30.2 answers them: `!=` applies to a float and a bool, and
          // `>` / `<` on a bool is a 400 ("Value of filter field `in_stock` must be `true` or `false`").
          filterable: [
            { field: "year", ops: ["eq", "neq", "gt", "gte", "lt", "lte"], type: "number" },
            { field: "rating", ops: ["eq", "neq", "gt", "gte", "lt", "lte"], type: "number" },
            { field: "in_stock", ops: ["eq", "neq"], type: "boolean" },
          ],
          grammar: {
            combine: { join: " && " },
            ops: { eq: "=", gt: ">", gte: ">=", lt: "<", lte: "<=", neq: "!=" },
            term: "{field}:{op}{value}",
          },
          maxLimit: 250,
          maxSortKeys: 3,
          params: { filter: "filter_by" },
          searchable: ["title", "author"],
          selectable: [],
          sortGrammar: { asc: "asc", desc: "desc", join: ",", term: "{field}:{direction}" },
          sortable: [
            { field: "year", type: "number" },
            { field: "rating", type: "number" },
            { field: "title", type: "string" },
          ],
        },
      },
      updateDocument: { ...TENANT, requestBody: json({ ...BOOK, required: [] }), responses: { "200": json(BOOK) } },
    },
    // Typesense answers a key's value only when it creates it (getKey: "Only the key prefix is
    // returned when you retrieve a key"), a secret by design. The document should mark it writeOnly
    // and does not; this says what it should.
    schemas: { ApiKeySchema: { properties: { value: { type: "string", writeOnly: true } } } },
  },
  principals: {
    alpha: { key: env("TYPESENSE_ADMIN_KEY"), scope: { collectionName: "alpha_books" }, tenant: "alpha" },
    beta: { key: env("TYPESENSE_BETA_KEY"), scope: { collectionName: "beta_books" }, tenant: "beta" },
    viewer: {
      key: env("TYPESENSE_VIEWER_KEY"),
      readOnly: true,
      scope: { collectionName: "alpha_books" },
      tenant: "alpha",
    },
  },
  security: { api_key_header: { static: "{principal.key}" } },
  spec: "./openapi.yml",
});
