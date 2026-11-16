import { describe, expect, it } from "vitest";

import { appServer } from "./server.ts";

// An env and a port picker the test owns, so no real socket opens and process.env stays put.
function deps(env: Record<string, string | undefined> = {}, port = 41234) {
  const picks: number[] = [];

  return {
    deps: {
      env,
      freePort: async () => {
        picks.push(port);

        return port;
      },
    },
    env,
    picks,
  };
}

describe("appServer", () => {
  it("names the server app, picks a free port and keeps it in the env for the workers", async () => {
    const given = deps();
    const app = await appServer({ command: "vite --port {port} --strictPort" }, given.deps);
    expect(app).toMatchObject({ name: "app", port: 41234, url: "http://localhost:41234" });
    expect(given.env).toEqual({ WORKERSTACK_WEB_PORT_APP: "41234" });
    expect(given.picks).toEqual([41234]);
  });

  it("reuses the port the main process kept, without picking another", async () => {
    const given = deps({ WORKERSTACK_WEB_PORT_DEV_SERVER: "40001" });
    const dev = await appServer({ command: "vite dev", name: "dev-server" }, given.deps);
    expect(dev.url).toBe("http://localhost:40001");
    expect(given.picks).toEqual([]);
  });

  it("fills {port} in the command and env, sets PORT, and never reuses a server it did not start", async () => {
    const { deps: injected } = deps();

    const app = await appServer(
      { command: "serve --port {port}", cwd: "site", env: { ORIGIN: "http://localhost:{port}" }, path: "/health" },
      injected,
    );

    expect(app.webServer).toEqual({
      command: "serve --port 41234",
      cwd: "site",
      env: { ORIGIN: "http://localhost:41234", PORT: "41234" },
      name: "app",
      reuseExistingServer: false,
      timeout: 30_000,
      url: "http://localhost:41234/health",
    });
  });

  it("takes the caller's start timeout", async () => {
    const app = await appServer({ command: "serve", timeout: 90_000 }, deps().deps);
    expect(app.webServer.timeout).toBe(90_000);
  });

  it("refuses a name that cannot be an env variable", async () => {
    await expect(appServer({ command: "serve", name: "Dev" }, deps().deps)).rejects.toThrow(
      'appServer: name "Dev" must be lowercase letters, digits and dashes',
    );
  });

  it("refuses a kept port that is not one", async () => {
    for (const kept of ["abc", "0", "70000", "80.5"]) {
      await expect(appServer({ command: "serve" }, deps({ WORKERSTACK_WEB_PORT_APP: kept }).deps)).rejects.toThrow(
        `appServer: WORKERSTACK_WEB_PORT_APP is ${JSON.stringify(kept)}, not a port`,
      );
    }
  });
});
