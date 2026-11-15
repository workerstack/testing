import { defineConfig, type PlaywrightTestConfig } from "@playwright/test";

import type { AppServer } from "./server.ts";

/** A Playwright config whose `server` replaces `webServer`: one `appServer`, or several. */
export type WebConfig<T = object, W = object> = Omit<PlaywrightTestConfig<T, W>, "webServer"> & {
  server?: AppServer | readonly AppServer[];
};

/**
 * Playwright's `defineConfig`, starting each server for the run and pointing `baseURL` at the
 * first; `test.only` fails the run on CI. The caller's own `baseURL` and `forbidOnly` win.
 */
export function defineWebConfig<T = object, W = object>(
  config: WebConfig<T, W>,
  env: Record<string, string | undefined> = process.env,
): PlaywrightTestConfig<T, W> {
  const { server, use, ...rest } = config;
  const servers: readonly AppServer[] = server === undefined ? [] : "webServer" in server ? [server] : server;
  const seen = new Set<string>();
  for (const { name } of servers) {
    if (seen.has(name)) throw new Error(`defineWebConfig: two servers are named "${name}"; give each its own name`);
    seen.add(name);
  }
  const result: PlaywrightTestConfig<T, W> = { forbidOnly: Boolean(env["CI"]), ...rest };
  if (use !== undefined) result.use = use;
  const [first] = servers;
  if (first === undefined) return defineConfig<T, W>(result);
  /* Playwright's CustomProperties<T> drops its own keys from T, so baseURL stays a string; TypeScript
   * cannot see that through the open generic. */
  result.use = { baseURL: first.url, ...use } as NonNullable<typeof use>;
  result.webServer = servers.map((each) => each.webServer);
  return defineConfig<T, W>(result);
}
