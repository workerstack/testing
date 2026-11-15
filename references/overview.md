---
description: What the API tester finds
order: 10
---

# Overview

[![npm](https://img.shields.io/npm/v/@workerstack/testing.svg)](https://www.npmjs.com/package/@workerstack/testing)

Testing for APIs, web apps and Workers. It ships `/api`, the API tester: live **matrix testing**
of a running backend against its own OpenAPI document. And `/web`: Playwright tests that fail on a page error and wait on the page, not the clock. The API tester reads the spec, talks to the API, and treats every way to see a record as a cell in a matrix: list,
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
