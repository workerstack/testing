import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

// A Playwright-only app installs none of the Solid peers. `./web` and `./web/dom` must still load
// for it, so the built entries are imported in a node whose resolver refuses those packages to
// the package's own files, as a consumer's would when they are missing. vitest still gets the
// vite it depends on. `./web/solid` is the control: it needs them.

const ROOT = join(import.meta.dirname, "..", "..");
const REFUSED = ["solid-js", "@solidjs/web", "@solidjs/vite-plugin", "vite"];

// Imports `entry` by name in a child node where the package's files cannot resolve the refused ones.
function loadWithout(entry: string): { code: number | null; stderr: string } {
  const script = `
		import { registerHooks } from "node:module"
		const refused = new Set(${JSON.stringify(REFUSED)})
		const dist = ${JSON.stringify(`${pathToFileURL(join(ROOT, "dist")).href}/`)}
		const name = (spec) => spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0]
		registerHooks({
			resolve(spec, context, next) {
				if (context.parentURL?.startsWith(dist) && refused.has(name(spec))) throw Object.assign(new Error("refused " + spec), { code: "ERR_MODULE_NOT_FOUND" })
				return next(spec, context)
			},
		})
		await import(${JSON.stringify(entry)})
	`;

  const child = spawnSync(process.execPath, ["--input-type=module", "-e", script], { cwd: ROOT, encoding: "utf8" });

  return { code: child.status, stderr: child.stderr };
}

describe("the web entries without the Solid peers", () => {
  it("load ./web and ./web/dom", () => {
    const loaded = Object.fromEntries(
      ["@workerstack/testing/web", "@workerstack/testing/web/dom"].map((entry) => [entry, loadWithout(entry)]),
    );

    expect(loaded).toEqual({
      "@workerstack/testing/web": { code: 0, stderr: "" },
      "@workerstack/testing/web/dom": { code: 0, stderr: "" },
    });
  });

  it("refuse ./web/solid, so the resolver bites", () => {
    const solid = loadWithout("@workerstack/testing/web/solid");
    expect(solid.code).toBe(1);
    expect(solid.stderr).toContain("refused @solidjs/web");
  });
});
