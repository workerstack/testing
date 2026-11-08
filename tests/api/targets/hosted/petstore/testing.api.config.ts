/*
 * Swagger Petstore v3, the public demo: a manual target, run by hand and never by `test:targets`.
 * Written with `testing api init`, then filled in. The demo accepts any key and any token, so the values
 * only need to be set; it is shared by everyone, so the API tester goes gently.
 *
 *   TESTING_API_PETSTORE_AUTH_TOKEN=demo TESTING_API_PETSTORE_API_KEY=special-key \
 *     testing api run --config tests/api/targets/hosted/petstore/testing.api.config.ts
 */
import { defineConfig, env } from "../../../../../src/api/index.ts"

export default defineConfig({
	spec: "https://petstore3.swagger.io/api/v3/openapi.json",
	baseUrl: "https://petstore3.swagger.io/api/v3",
	maxRps: 2,
	security: {
		// oauth2 implicit, sent as Authorization: Bearer; the API tester performs only clientCredentials and password grants
		petstore_auth: { holds: ["read:pets", "write:pets"], static: env("TESTING_API_PETSTORE_AUTH_TOKEN") },
		// apiKey in header api_key; the demo documents "special-key"
		api_key: { static: env("TESTING_API_PETSTORE_API_KEY") },
	},
	principals: {
		alpha: {},
	},
})
