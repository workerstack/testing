import { readFileSync } from "node:fs";
import { join, posix } from "node:path";

import type { Context, Node, Rule } from "./ast.ts";
import { packageName } from "./boundaries.ts";
import { isTestCode, repoPath } from "./paths.ts";

// The web helpers' arrows. `src/web/` imports node builtins, its own files and the browser stack it
// is written against; that stack is an optional peer, so an API-only consumer never installs it, and
// a peer the manifest does not declare would fail in a consumer that has not installed it.
// `src/web/solid/` adds Solid, vite and the parse5 dependency, so a non-Solid app never loads them. `src/web/dom/` runs in the page
// under vitest's browser mode, so it imports only itself and vitest: never Playwright or a builtin. Neither imports the API tester,
// and the API tester's own rule refuses the reverse.
const MESSAGE =
  "a web module imports node builtins, web itself and its declared optional peers only (see AGENTS.md: dependency arrows)";

const DOM_MESSAGE =
  "a web/dom module runs in the page: it imports web/dom itself and vitest only (see AGENTS.md: dependency arrows)";

const WEB_PACKAGES: ReadonlySet<string> = new Set(["@playwright/test", "@axe-core/playwright", "vitest"]);

const SOLID_PACKAGES: ReadonlySet<string> = new Set([
  "solid-js",
  "@solidjs/web",
  "@solidjs/vite-plugin",
  "vite",
  "parse5",
]);

const inSolid = (rel: string): boolean => rel.startsWith("solid/");
const inDom = (rel: string): boolean => rel.startsWith("dom/");

// A page module: its own folder and vitest, the one peer that runs in the page.
function domImportAllowed(from: string, spec: string, peers: ReadonlySet<string>): boolean {
  if (spec.startsWith(".")) return inDom(posix.join(posix.dirname(from), spec));

  return packageName(spec) === "vitest" && peers.has("vitest");
}

/** Whether the module at `from` (relative to `src/web/`) may import `spec`, given the declared peers. */
export function webImportAllowed(input: { from: string; spec: string; peers: ReadonlySet<string> }): boolean {
  const { from, peers, spec } = input;

  if (inDom(from)) return domImportAllowed(from, spec, peers);

  if (spec.startsWith("node:")) return true;

  if (spec.startsWith(".")) {
    const target = posix.join(posix.dirname(from), spec);

    return !target.startsWith("../") && (inSolid(from) || !inSolid(target));
  }

  const name = packageName(spec);

  if (!peers.has(name)) return false;

  return WEB_PACKAGES.has(name) || (SOLID_PACKAGES.has(name) && inSolid(from));
}

// What the manifest declares: a peer, or a dependency every install brings.
function declaredPeers(): Set<string> {
  const manifest = JSON.parse(readFileSync(join(import.meta.dirname, "..", "package.json"), "utf8")) as {
    dependencies: Record<string, string>;
    peerDependencies: Record<string, string>;
  };

  return new Set([...Object.keys(manifest.peerDependencies), ...Object.keys(manifest.dependencies)]);
}

type Importing = Node & {
  source?: { type: string; value?: unknown } | null;
};

export const rule: Rule = {
  create(context: Context) {
    const file = repoPath(context.filename);
    const at = file.lastIndexOf("/src/web/");

    if (at === -1 || isTestCode(file)) return {};
    const from = file.slice(at + "/src/web/".length);
    let peers: Set<string> | undefined;

    const check = (node: Importing): void => {
      const source = node.source;

      if (source?.type !== "Literal" || typeof source.value !== "string") return;
      peers ??= declaredPeers();

      if (!webImportAllowed({ from, peers, spec: source.value }))
        context.report({ message: inDom(from) ? DOM_MESSAGE : MESSAGE, node });
    };

    return {
      ExportAllDeclaration: check,
      ExportNamedDeclaration: check,
      ImportDeclaration: check,
      ImportExpression: check,
    };
  },
};
