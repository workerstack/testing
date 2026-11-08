# @workerstack/testing

[![npm](https://img.shields.io/npm/v/@workerstack/testing.svg)](https://www.npmjs.com/package/@workerstack/testing)

Testing for APIs, web apps and Workers. Today it ships `/api`, the API tester: live **matrix testing**
of a running backend against its own OpenAPI document. The API tester reads the spec, talks to the API, and treats every way to see a record as a cell in a matrix: list,
item, filter, sort, page, cursor, select, search, parent routes, another tenant. Then it checks that
the cells agree. It never reads your source or assumes your framework.

A schema fuzzer asks _did this answer match its schema?_ The API tester asks that of every request it sends,
and then the questions only state can answer:

- the row is on `GET /tables/{id}` and missing from `GET /tables`
- `?filter=status.eq.nope` returns every row (the backend dropped the parameter)
- `limit=2` walks to 9 rows and `limit=100` to 10 (the sort has no total order)
- `PATCH { name }` also cleared `description`
- `?filter=id.eq.<another tenant's id>` returns that tenant's row

There is no ground-truth database. A filter and its negation must partition the set, a page walk
must cover the collection, and a record read four ways must read the same. One root cause is one
finding; the checks that depend on it are `BLOCKED`, not a page of copies.

## Install

```bash
npm i -D @workerstack/testing
```

Requires **Node.js 22.18 or later**. The API tester reads OpenAPI 3.0–3.2 documents, in JSON or YAML, and
runs as `testing api`. Renamed: [the migration guide](docs/api/migrating-from-oat.md) maps every name.

## Quick start

```bash
testing api doctor --spec https://api.example.com/openapi.json   # offline: what the API tester can test, and what is missing
testing api init --spec https://api.example.com/openapi.json     # writes testing.api.config.ts from the security schemes
testing api run --config testing.api.config.ts                            # tests the running API
```

`doctor` names every coverage gap and the tag that would close it. To see the API tester find bugs first, run
the bundled demo API with planted defects (`testing api serve --defects STALE_LIST,PATCH_REPLACES`) and
point `labs/api/local.config.ts` at the URL it prints.

## Authentication

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

## Verdicts and exit codes

| verdict        | meaning                                                           |
| -------------- | ----------------------------------------------------------------- |
| `BACKEND_BUG`  | the handler is wrong                                              |
| `SPEC_BUG`     | the document is wrong, or disagrees with the handler              |
| `SECURITY`     | an isolation or authorization failure across a declared boundary  |
| `AMBIGUITY`    | the same evidence, where the boundary was only inferred           |
| `COVERAGE_GAP` | a check could not run; the report names the tag that would let it |
| `BLOCKED`      | a check this one depends on already failed                        |

| exit | means                                                                            |
| ---- | -------------------------------------------------------------------------------- |
| `0`  | no defects                                                                       |
| `1`  | a root-cause finding (`BACKEND_BUG`, `SPEC_BUG`, `SECURITY`, `AMBIGUITY`)        |
| `2`  | usage: a missing or wrong flag, or a config the document contradicts             |
| `3`  | The API tester could not do what it was asked (the network never came back, say) |
| `4`  | the run may have left records behind; they are listed under Leftovers            |

Any non-zero exit fails CI. Gaps and blocked checks never fail a full run on their own.

## CI

```yaml
- run: npm i -D @workerstack/testing
- run: npx testing api doctor --spec "$SPEC_URL"
- run: npx testing api run --config testing.api.config.ts
  env:
    API_TOKEN: ${{ secrets.API_TOKEN }}
    API_TOKEN_B: ${{ secrets.API_TOKEN_B }}
```

The report is written to `.testing/api/runs/latest/report.json`; read it to sort findings by verdict.

## Limits

- Bodies are generated from the document; the API tester checks HTTP statuses and JSON, never file contents.
- A 429 is retried up to 5 times, honoring `Retry-After` up to `network.maxRetryAfterMs` (default 60s); a longer wait is not waited for, and the 429 stands.
- Leftover rows on a shared database poison the numeric and filter checks: wipe them between runs.
- Webhooks, callbacks and links are not followed, and URL `$ref`s are not fetched.

The full list, with what you see and what to do instead, is in [docs/api/limits.md](docs/api/limits.md).

## Docs

- [Commands](docs/api/commands.md): `run`, `doctor`, `plan`, `init`, `serve`, `conformance`
- [Configuration](docs/api/configuration/reference.md): every field; then [principals and security](docs/api/configuration/principals-and-security.md), [hooks](docs/api/configuration/hooks.md), [origins and uploads](docs/api/configuration/origins-and-uploads.md)
- [Migrating to 0.25](docs/api/migrating-0.25.md): the removed config fields, and relative paths now read from the config's folder
- [How the API tester reads a document](docs/api/model.md): how a run works, entities, seeding, query grammars
- [OpenAPI tags](docs/api/tags.md): every `x-*` tag and what it unlocks
- [Checks and verdicts](docs/api/checks.md): what each check needs and asserts
- [Reports](docs/api/reports.md): `report.json`, `matrix.json`, repro scripts, progress logs
- [Programmatic API](docs/api/api.md); [step builders](docs/api/steps.md): typed scenario steps from `@workerstack/testing/api/steps`
- [Assumptions](docs/api/assumptions.md): what the API tester assumes, and how to declare an exception
- [Migrating](docs/api/migrating-from-oat.md): every name the rename changed, old to new
- [Limits](docs/api/limits.md): what the API tester cannot do, and what to do instead
- [Reference defects](docs/api/reference-defects.md): the named lies `testing api serve --defects` can tell
- [Releasing](docs/api/releasing.md): how a tag publishes to npm with provenance, and the steps to cut one

## License

MIT
