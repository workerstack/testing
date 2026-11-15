---
description: The full docs
order: 70
---

# Docs

- [Commands](../docs/api/commands.md): `run`, `doctor`, `plan`, `init`, `serve`, `conformance`
- [Configuration](../docs/api/configuration/reference.md): every field; then [principals and security](../docs/api/configuration/principals-and-security.md), [hooks](../docs/api/configuration/hooks.md), [origins and uploads](../docs/api/configuration/origins-and-uploads.md)
- [Migrating to 0.25](../docs/api/migrating-0.25.md): the removed config fields, and relative paths now read from the config's folder; [from the old name](../docs/api/migrating-from-oat.md): every name the rename changed, old to new
- [How the API tester reads a document](../docs/api/model.md): how a run works, entities, seeding, query grammars
- [OpenAPI tags](../docs/api/tags.md): every `x-*` tag and what it unlocks
- [Checks and verdicts](../docs/api/checks.md): what each check needs and asserts
- [Reports](../docs/api/reports.md): `report.json`, `matrix.json`, repro scripts, progress logs
- [Programmatic API](../docs/api/api.md); [step builders](../docs/api/steps.md): typed scenario steps from `@workerstack/testing/api/steps`
- [Assumptions](../docs/api/assumptions.md): what the API tester assumes, and how to declare an exception
- [Limits](../docs/api/limits.md): what the API tester cannot do, and what to do instead
- [Reference defects](../docs/api/reference-defects.md): the named lies `testing api serve --defects` can tell
- [Web tests](../docs/web/web.md): `test`, its page `guard`, `ready`, `a11y`, `network`, `pointer` and `appServer` from `@workerstack/testing/web`; [in-page tests](../docs/web/dom.md): `pointer` and self-restoring `stubs` from `@workerstack/testing/web/dom`; [Solid server render and hydration](../docs/web/solid.md) from `@workerstack/testing/web/solid`
- [Releasing](../docs/api/releasing.md): how a tag publishes to npm with provenance, and the steps to cut one
