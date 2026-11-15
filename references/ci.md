---
description: Running it in CI
order: 50
---

# CI

```yaml
- run: npm i -D @workerstack/testing
- run: npx testing api doctor --spec "$SPEC_URL"
- run: npx testing api run --config testing.api.config.ts
  env:
    API_TOKEN: ${{ secrets.API_TOKEN }}
    API_TOKEN_B: ${{ secrets.API_TOKEN_B }}
```

The report is written to `.testing/api/runs/latest/report.json`; read it to sort findings by verdict.
