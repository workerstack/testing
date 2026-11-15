import { describe, expect, it } from "vitest";

import { defineWebConfig } from "./config.ts";
import type { AppServer } from "./server.ts";

const server = (name: string, port: number): AppServer => ({
  name,
  port,
  url: `http://localhost:${port}`,
  webServer: { command: `serve ${name}`, name, reuseExistingServer: false, url: `http://localhost:${port}/` },
});

describe("defineWebConfig", () => {
  it("starts the server and points baseURL at it", () => {
    const app = server("app", 40001);
    const config = defineWebConfig({ server: app, testDir: "e2e" }, {});
    expect(config.webServer).toEqual([app.webServer]);
    expect(config.use?.baseURL).toBe("http://localhost:40001");
    expect(config.testDir).toBe("e2e");
  });

  it("starts every server, and the first one is the default baseURL", () => {
    const app = server("app", 40001);
    const dev = server("dev", 40002);
    const config = defineWebConfig({ projects: [{ name: "dev", use: { baseURL: dev.url } }], server: [app, dev] }, {});
    expect(config.webServer).toEqual([app.webServer, dev.webServer]);
    expect(config.use?.baseURL).toBe(app.url);
    expect(config.projects?.[0]?.use?.baseURL).toBe(dev.url);
  });

  it("forbids test.only on CI, and leaves both defaults to the caller's own values", () => {
    expect(defineWebConfig({}, { CI: "true" }).forbidOnly).toBe(true);
    expect(defineWebConfig({}, {}).forbidOnly).toBe(false);
    expect(defineWebConfig({}, { CI: "" }).forbidOnly).toBe(false);
    const own = defineWebConfig(
      { forbidOnly: false, server: server("app", 40001), use: { baseURL: "http://example.test", locale: "en-US" } },
      { CI: "true" },
    );
    expect(own.forbidOnly).toBe(false);
    expect(own.use).toEqual({ baseURL: "http://example.test", locale: "en-US" });
  });

  it("starts nothing and sets no baseURL without a server", () => {
    const config = defineWebConfig({ use: { locale: "en-US" } }, {});
    expect(config.webServer).toBeUndefined();
    expect(config.use).toEqual({ locale: "en-US" });
  });

  it("refuses two servers with one name, since they would share a port", () => {
    expect(() => defineWebConfig({ server: [server("app", 40001), server("app", 40001)] }, {})).toThrow(
      'defineWebConfig: two servers are named "app"; give each its own name',
    );
  });
});
