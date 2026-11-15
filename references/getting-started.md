---
description: Install and first run
order: 20
---

# Getting started

## Install

```bash
npm i -D @workerstack/testing
```

Requires **Node.js 22.18 or later**. The API tester reads OpenAPI 3.0–3.2 documents, in JSON or YAML, and
runs as `testing api`. Renamed: [the migration guide](../docs/api/migrating-from-oat.md) maps every name.

## Quick start

```bash
testing api doctor --spec https://api.example.com/openapi.json   # offline: what the API tester can test, and what is missing
testing api init --spec https://api.example.com/openapi.json     # writes testing.api.config.ts from the security schemes
testing api run --config testing.api.config.ts                            # tests the running API
```

`doctor` names every coverage gap and the tag that would close it. To see the API tester find bugs first, run
the bundled demo API with planted defects (`testing api serve --defects STALE_LIST,PATCH_REPLACES`) and
point `labs/api/local.config.ts` at the URL it prints.
