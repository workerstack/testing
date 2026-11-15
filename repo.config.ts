import { defineConfig } from "@workerstack/repo";

export default defineConfig({
  packs: ["agents", "standards", "docs"],
  link: { push: "allow" },
  workflow: "worktree",
  agents: {
    defaultApproval: "ask",
    defaultEffort: "fast",
    defaultStrategy: "spawn-fast",
    hosts: ["claude", "codex", "antigravity", "grok", "cursor"],
  },
  lint: {
    plugins: { testing: "lint/index.ts" },
    rules: [
      {
        rules: {
          "testing/boundaries": "error",
          "testing/exit-only-in-cli": "error",
          "testing/grammar-through-renderer": "error",
          "testing/id-through-reader": "error",
          "testing/index-purity": "error",
          "testing/max-params": "error",
          "testing/network-through-client": "error",
          "testing/no-console": "error",
          "testing/no-header-branching": "error",
          "testing/no-module-side-effects": "error",
          "testing/no-module-state": "error",
          "testing/no-v8-ignore": "error",
          "testing/proven-id-origin": "error",
          "testing/web-boundaries": "error",
        },
      },
    ],
    skip: [
      {
        files: ["src/api/report/render/junit.ts"],
        rules: ["eslint/no-control-regex"],
        reason: "XML_INVALID matches the C0 control characters XML 1.0 forbids, so the report can escape them",
      },
      {
        files: ["tests/web/support/site.ts"],
        rules: ["eslint/no-empty-pattern"],
        reason: "Playwright reads a fixture's dependencies from its first parameter's pattern, and `{}` is none",
      },
    ],
  },
  knip: {
    ignore: [
      {
        file: "tests/api/types/config.typetest.ts",
        reason: "tsc -p tsconfig.test.json checks it for type errors; nothing imports a type test",
      },
      {
        file: "tests/api/types/proven-id.typetest.ts",
        reason: "tsc -p tsconfig.test.json checks it for type errors; nothing imports a type test",
      },
      {
        file: "tests/api/types/public-api.typetest.ts",
        reason: "tsc -p tsconfig.test.json checks it for type errors; nothing imports a type test",
      },
      {
        file: "tests/web/support/serve-pages.ts",
        reason: "tests/web/consumer/server.config.ts starts it as the node command of its app server",
      },
    ],
  },
});
