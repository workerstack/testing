/// <reference types="vitest/config" />
import solid from "@solidjs/vite-plugin";
import type * as SolidWeb from "@solidjs/web";
import type { JSX } from "@solidjs/web";
import { createServer, type Plugin, type PluginOption, type ViteDevServer } from "vite";
import type { BrowserCommand, BrowserCommandContext } from "vitest/node";

import type { ServerRendered } from "./hydration.ts";
import { recordWarnings } from "./warnings.ts";

/*
 * The node half of a hydration test. A browser test asks for a fixture's server HTML; this renders
 * it through vite's SSR loader with Solid compiled for the server, as an SSR app's request handler
 * does, so the browser hydrates the HTML a real server would send.
 */

export interface SolidHydrationOptions {
  /** More plugins for the server that renders fixtures, such as path aliases the app's code needs. */
  plugins?: PluginOption[];
}

type FixtureModule = Record<string, (() => JSX.Element) | undefined>;

type ServerRender = BrowserCommand<[fixture: string, name: string], Promise<ServerRendered>>;

/* Opens the SSR server on first use and keeps it until `close`. */
function lazyServer(plugins: PluginOption[]): {
  get: (root: string) => Promise<ViteDevServer>;
  close: () => Promise<void>;
} {
  let server: Promise<ViteDevServer> | undefined;
  return {
    close: async () => {
      const open = server;
      server = undefined;
      await (await open)?.close();
    },
    get: (root) => {
      server ??= createServer({
        appType: "custom",
        configFile: false,
        logLevel: "silent",
        optimizeDeps: { noDiscovery: true },
        plugins: [solid({ refresh: false, ssr: true }), ...plugins],
        root,
        server: { hmr: false, middlewareMode: true, watch: null },
      });
      return server;
    },
  };
}

/** The vite plugin that lets `hydrator` render fixtures on the server: add it to the hydration project. */
export function solidHydration(options: SolidHydrationOptions = {}): Plugin {
  const ssr = lazyServer(options.plugins ?? []);
  const serverRender: ServerRender = async (context: BrowserCommandContext, fixture, name) => {
    const server = await ssr.get(context.project.config.root);
    const fixtures = (await server.ssrLoadModule(fixture)) as FixtureModule;
    const web = (await server.ssrLoadModule("@solidjs/web")) as typeof SolidWeb;
    const component = fixtures[name];
    if (component === undefined) throw new Error(`solidHydration: ${fixture} exports no ${name}`);
    const { result, warnings } = recordWarnings(() => web.renderToString(() => web.createComponent(component, {})));
    return { html: result, warnings };
  };
  return {
    config: () => ({
      test: { browser: { commands: { serverRender } } },
    }),
    configureVitest: ({ vitest }) => {
      vitest.onClose(ssr.close);
    },
    name: "@workerstack/testing/web/solid",
  };
}
