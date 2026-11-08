/**
 * Points at the demo API that ships with the API tester, so this runs end to end with no setup.
 *
 *   testing api serve                                    # terminal 1 — prints a url
 *   testing api run --config labs/api/local.config.ts --base-url <that url>
 *
 * Real configs import from "@workerstack/testing/api"; this one uses a relative path because it lives inside the
 * repository.
 */

import { defineConfig } from "../../dist/api/index.js"

/* Overridden by --base-url, which is what `testing api serve` prints. */
const API = process.env["TESTING_API_BASE_URL"] ?? "http://127.0.0.1:8787"

export default defineConfig({
	baseUrl: API,
	principals: {
		alpha: { key: "key_alpha", scope: { project_id: "proj_alpha" }, tenant: "proj_alpha" },
		/* A second principal in a different tenant — this is what makes the isolation checks
		 * possible. Without one they are skipped rather than silently passed. */
		beta: { key: "key_beta", scope: { project_id: "proj_beta" }, tenant: "proj_beta" },
	},
	/* The demo API's jwt scheme: each principal trades its key at auth.token for the token. */
	security: {
		jwt: {
			login: { from: "$.access_token", steps: [{ body: { key: "{principal.key}" }, operationId: "auth.token" }] },
		},
	},
	seed: 42,
	/* Relative to baseUrl — the API tester also accepts an absolute URL or a filesystem path. */
	spec: "/v1/openapi/spec",
})
