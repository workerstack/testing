import { defineConfig, env } from "../../../../src/api/index.ts";

// Keycloak 26.8.1, Admin REST API (spec vendored from keycloak.org/docs-api/26.8.1/rest-api/openapi.json).
// The document declares no security scheme and no operationIds, so the API tester names each operation
// `METHOD /path`. The overlay declares the bearer token Keycloak takes as the OAuth 2
// client-credentials grant that issues it, so the API tester mints and renews each principal's token at the
// master realm's token endpoint itself.
//
// Scope: the read surface of a realm's users, groups, clients, roles and client scopes, and the
// writes of its users and groups, as a delegated realm admin (alpha), a peer realm's admin (beta)
// and a read-only operator (viewer) see it. A create answers 201 with the new id only in its
// Location header, which the API tester reads the id from.

const READS = [
  "GET /admin/realms/{realm}/users",
  "GET /admin/realms/{realm}/users/count",
  "GET /admin/realms/{realm}/users/{user-id}",
  "GET /admin/realms/{realm}/groups",
  "GET /admin/realms/{realm}/groups/count",
  "GET /admin/realms/{realm}/groups/{group-id}",
  "GET /admin/realms/{realm}/clients",
  "GET /admin/realms/{realm}/clients/{client-uuid}",
  "GET /admin/realms/{realm}/roles",
  "GET /admin/realms/{realm}/roles/{role-name}",
  "GET /admin/realms/{realm}/client-scopes",
  "GET /admin/realms/{realm}/client-scopes/{client-scope-id}",
];

const WRITES = [
  "POST /admin/realms/{realm}/users",
  "PUT /admin/realms/{realm}/users/{user-id}",
  "DELETE /admin/realms/{realm}/users/{user-id}",
  "POST /admin/realms/{realm}/groups",
  "PUT /admin/realms/{realm}/groups/{group-id}",
  "DELETE /admin/realms/{realm}/groups/{group-id}",
];

const json = (schema: object) => ({ content: { "application/json": { schema } }, required: true });

// A user a create makes: a lowercase username, an address, enabled.
const USER = {
  properties: {
    email: { format: "email", type: "string" },
    enabled: { type: "boolean" },
    firstName: { maxLength: 40, type: "string" },
    username: { pattern: "^[a-z][a-z0-9-]{2,20}$", type: "string" },
  },
  required: ["username", "email", "enabled"],
  type: "object",
};

// A top-level group: its name alone.
const GROUP = {
  properties: { name: { pattern: "^[a-z][a-z0-9-]{2,20}$", type: "string" } },
  required: ["name"],
  type: "object",
};

// No order, select or free-text parameter on any of these lists.
const NO_QUERY = { searchable: [], selectable: [], sortable: [] };

export default defineConfig({
  allow: [...READS, ...WRITES],
  baseUrl: env("KEYCLOAK_URL"),
  entities: {
    client: {
      query: { filterable: [{ field: "clientId", ops: ["eq"], type: "string" }], grammar: "equality", ...NO_QUERY },
    },
    "client-scope": { query: { filterable: [], ...NO_QUERY } },
    group: { query: { filterable: [], ...NO_QUERY } },
    role: { query: { filterable: [], ...NO_QUERY } },
    // `username`, `email`, `firstName` and `lastName` match substrings unless `exact=true`, and `q`
    // searches attributes as `key:value`: only the exact-match parameters are filterable.
    user: {
      query: {
        filterable: [
          { field: "enabled", ops: ["eq"], type: "boolean" },
          { field: "emailVerified", ops: ["eq"], type: "boolean" },
        ],
        grammar: "equality",
        ...NO_QUERY,
      },
    },
  },
  ops: [...READS, ...WRITES],
  overlay: {
    // The document's representations take every field Keycloak has, none of them typed: the
    // writes send only what a create needs, an email as an address, and never an id.
    operations: {
      "POST /admin/realms/{realm}/groups": { requestBody: json(GROUP) },
      // A realm holds one user per username and per email: each cohort member needs its own.
      "POST /admin/realms/{realm}/users": { requestBody: json(USER), "x-unique": [["username"], ["email"]] },
      "PUT /admin/realms/{realm}/groups/{group-id}": { requestBody: json(GROUP) },
      "PUT /admin/realms/{realm}/users/{user-id}": { requestBody: json({ ...USER, required: [] }) },
    },
    security: [{ bearer: [] }],
    securitySchemes: {
      bearer: {
        flows: { clientCredentials: { scopes: {}, tokenUrl: "/realms/master/protocol/openid-connect/token" } },
        type: "oauth2",
      },
    },
  },
  principals: {
    alpha: {
      clientId: env("KEYCLOAK_ALPHA_CLIENT_ID"),
      scope: { realm: "testing-a" },
      secret: env("KEYCLOAK_ALPHA_SECRET"),
      tenant: "testing-a",
    },
    beta: {
      clientId: env("KEYCLOAK_BETA_CLIENT_ID"),
      scope: { realm: "testing-b" },
      secret: env("KEYCLOAK_BETA_SECRET"),
      tenant: "testing-b",
    },
    viewer: {
      clientId: env("KEYCLOAK_VIEWER_CLIENT_ID"),
      readOnly: true,
      scope: { realm: "testing-a" },
      secret: env("KEYCLOAK_VIEWER_SECRET"),
      tenant: "testing-a",
    },
  },
  security: {
    bearer: {
      oauth2: { clientId: "{principal.clientId}", clientSecret: "{principal.secret}", flow: "clientCredentials" },
    },
  },
  spec: "./openapi.json",
});
