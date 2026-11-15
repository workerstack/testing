---
description: What it does not do
order: 60
---

# Limits

- Bodies are generated from the document; the API tester checks HTTP statuses and JSON, never file contents.
- A 429 is retried up to 5 times, honoring `Retry-After` up to `network.maxRetryAfterMs` (default 60s); a longer wait is not waited for, and the 429 stands.
- Leftover rows on a shared database poison the numeric and filter checks: wipe them between runs.
- Webhooks, callbacks and links are not followed, and URL `$ref`s are not fetched.

The full list, with what you see and what to do instead, is in [docs/api/limits.md](../docs/api/limits.md).
