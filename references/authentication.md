---
description: Credentials per security scheme
order: 30
---

# Authentication

Each operation is sent the credentials its OpenAPI `security` requires, placed where its scheme
says. The config only says how to get each scheme's value:

```ts
// testing.api.config.ts
import { defineConfig } from "@workerstack/testing/api"

export default defineConfig({
	spec: "https://api.example.com/openapi.json",
	baseUrl: "https://api.example.com",
	security: { bearer: { static: "${API_TOKEN}" } },
	principals: {
		alpha: { tenant: "a" },
		beta: { tenant: "b", security: { bearer: { static: "${API_TOKEN_B}" } } },
	},
})
```

| recipe   | the value                                                                         |
| -------- | --------------------------------------------------------------------------------- |
| `static` | a fixed token or key, or `{ username, password }` for basic auth                  |
| `login`  | steps the API tester runs (a sign-in), then where the credential is in the answer |
| `mint`   | an operation called with another scheme's credential (an API key)                 |
| `oauth2` | a `clientCredentials` or `password` grant at the document's token URL             |
| `hook`   | `hooks.resolveCredential` returns it                                              |

A second principal in another `tenant` is what makes the isolation checks run.
