import { defineConfig, env } from "../../../../src/api/index.ts";

// Immich v3.3.5 (spec vendored from open-api/immich-openapi-specs.json at that tag). Every operation
// takes any of three schemes: bearer (the session token), cookie (the same token as
// immich_access_token) and api_key (x-api-key). The API tester sends bearer first; the security checks grade
// cookie and api_key as alternatives and probe each scheme with forged and revoked values.
//
// Scope: albums, tags, API keys and the caller's own user and preferences, the resources a user
// owns that need no upload. `allow` keeps every other operation out of reach, so nothing outside
// that scope is called, even as support.

const login = {
  from: "$.accessToken",
  revoke: "logout",
  steps: [{ body: { email: "{principal.email}", password: "{principal.password}" }, operationId: "login" }] as [
    { operationId: string; body: Record<string, string> },
  ],
};

const albums = ["createAlbum", "getAllAlbums", "getAlbumInfo", "updateAlbumInfo", "deleteAlbum", "getAlbumStatistics"];
const tags = ["createTag", "getAllTags", "getTagById", "updateTag", "deleteTag", "upsertTags"];

const apiKeys = [
  "createApiKey",
  "getApiKeys",
  "getApiKey",
  "getMyApiKey",
  "updateApiKey",
  "deleteApiKey",
  "rotateApiKey",
];

const me = ["getMyUser", "updateMyUser", "getMyPreferences", "updateMyPreferences"];

export default defineConfig({
  allow: ["login", "logout", ...albums, ...tags, ...apiKeys, ...me],
  baseUrl: env("IMMICH_URL"),
  ops: [...albums, ...tags, ...apiKeys, ...me, "logout"],
  overlay: {
    // The server stamps updatedAt on every write; the API tester treats only snake_case timestamps as such.
    operations: { updateAlbumInfo: { "x-generated": ["updatedAt"] } },
    schemas: {
      // Optional fields that take the id of an existing user, asset or parent tag; the API tester has none to send.
      CreateAlbumDto: { properties: { albumUsers: null, assetIds: null } },
      TagCreateDto: { properties: { parentId: null } },
      UpdateAlbumDto: { properties: { albumThumbnailAssetId: null } },
      // A write to these locks the principal out of its own login for the rest of the run.
      UserUpdateMeDto: { properties: { email: null, password: null } },
    },
  },
  principals: {
    alpha: { email: env("IMMICH_ALPHA_EMAIL"), password: env("IMMICH_ALPHA_PASSWORD"), tenant: "alpha" },
    beta: { email: env("IMMICH_BETA_EMAIL"), password: env("IMMICH_BETA_PASSWORD"), tenant: "beta" },
  },
  security: {
    api_key: {
      mint: {
        body: { name: "testing", permissions: ["all"] },
        from: "$.secret",
        operationId: "createApiKey",
        revoke: "deleteApiKey",
        with: "bearer",
      },
    },
    bearer: { login },
    cookie: { login },
  },
  spec: "./openapi.json",
});
