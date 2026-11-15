import { hydrate, type JSX } from "@solidjs/web";
import { flush } from "solid-js";

import { createHydrator, type Hydrated, type HydrationRuntime, type ServerRendered } from "./hydration.ts";

declare module "vitest/browser" {
  interface BrowserCommands {
    /** Added by `solidHydration()`: renders a fixture module's export on the server. */
    serverRender: (fixture: string, name: string) => Promise<ServerRendered>;
  }
}

/* vitest's browser module, loaded on the first call, so a node test can import this entry. */
const browser: HydrationRuntime["browser"] = () =>
  import("vitest/browser").catch((cause: unknown) => {
    throw new Error("hydrate: runs in vitest's browser mode; this test runs in node", { cause });
  });

const RUNTIME: HydrationRuntime = { browser, flush, hydrate };

/**
 * A `hydrate(name)` for one fixture module. Each call renders the named fixture on the server (in
 * node, through `solidHydration()`), puts the HTML in the page and hydrates it in the browser, and
 * disposes it after the test. `fixture` is the module's URL: `new URL("./x.fixture.tsx", import.meta.url)`.
 */
export function hydrator<Name extends string>(
  fixture: URL,
  fixtures: Record<Name, () => JSX.Element>,
): (name: Name) => Promise<Hydrated> {
  return createHydrator(RUNTIME, fixture, fixtures);
}
