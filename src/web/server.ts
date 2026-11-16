import type { PlaywrightTestConfig } from "@playwright/test";

import { freePort } from "./port.ts";

// An app a Playwright run starts on a port the OS picked. Playwright loads the config again in
// every worker, so the port the main process picked is kept in the env, which each worker
// inherits; a worker reads it back instead of picking its own. Playwright's webServer starts the
// command, probes the URL and stops the process group when the run ends.

/** One entry of Playwright's `webServer`. */
type WebServer = Extract<NonNullable<PlaywrightTestConfig["webServer"]>, { command: string }>;

export type AppServerOptions = {
  /** The shell command that serves the app; `{port}` is replaced with the port, which is also in `PORT`. */
  command: string;
  /** Names the server in the run's log and in its env variable; lowercase letters, digits and dashes. */
  name?: string;
  /** The path probed until it answers; `/` by default. */
  path?: string;
  /** How long the app may take to answer, in milliseconds; 30000 by default. */
  timeout?: number;
  /** Env for the command; `{port}` is replaced in each value. */
  env?: Record<string, string>;
  /** Where the command runs, from the config's directory. */
  cwd?: string;
};

/** A server to pass to `defineWebConfig`, and its URL for a project's `baseURL`. */
export type AppServer = {
  name: string;
  port: number;
  url: string;
  webServer: WebServer;
};

type AppServerDeps = {
  env: Record<string, string | undefined>;
  freePort: () => Promise<number>;
};

const NAME = /^[a-z][a-z0-9-]*$/;
const MAX_PORT = 65_535;

async function keptPort(key: string, deps: AppServerDeps): Promise<number> {
  const kept = deps.env[key];

  if (kept === undefined) {
    const port = await deps.freePort();
    deps.env[key] = String(port);

    return port;
  }

  const port = Number(kept);

  if (!Number.isInteger(port) || port < 1 || port > MAX_PORT)
    throw new Error(`appServer: ${key} is ${JSON.stringify(kept)}, not a port`);

  return port;
}

/** Picks the app's port, or reads back the one the main process kept, and describes how to start it. */
export async function appServer(
  options: AppServerOptions,
  deps: AppServerDeps = { env: process.env, freePort },
): Promise<AppServer> {
  const { command, cwd, env = {}, name = "app", path = "/", timeout = 30_000 } = options;

  if (!NAME.test(name))
    throw new Error(`appServer: name ${JSON.stringify(name)} must be lowercase letters, digits and dashes`);
  const port = await keptPort(`WORKERSTACK_WEB_PORT_${name.toUpperCase().replaceAll("-", "_")}`, deps);
  const fill = (text: string): string => text.replaceAll("{port}", String(port));
  const url = `http://localhost:${port}`;
  const filled = Object.fromEntries(Object.entries(env).map(([key, value]) => [key, fill(value)]));

  return {
    name,
    port,
    url,
    webServer: {
      command: fill(command),
      ...(cwd === undefined ? {} : { cwd }),
      env: { ...filled, PORT: String(port) },
      name,
      reuseExistingServer: false,
      timeout,
      url: `${url}${path}`,
    },
  };
}
