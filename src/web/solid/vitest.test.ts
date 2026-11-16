import { join } from "node:path";

import type { Plugin } from "vite";
import { afterEach, describe, expect, it, vi } from "vitest";

import { solidHydration } from "./vitest.ts";

// The plugin's server renders a real fixture: vite in middleware mode, with no HMR or watcher,
// opens no socket. A plugin passed in counts the servers it opens.
const ROOT = join(import.meta.dirname, "..", "..", "..");
const FIXTURE = "/tests/web/solid/greeting.fixture.tsx";
const CONTEXT = { project: { config: { root: ROOT } } } as never;

type Command = (context: never, fixture: string, name: string) => Promise<{ html: string; warnings: string[] }>;

type Wired = {
  serverRender: Command;
  config: unknown;
  close: () => Promise<void>;
  opened: () => number;
};

function wire(): Wired {
  let opened = 0;
  const counter: Plugin = { configureServer: () => void (opened += 1), name: "count" };
  const plugin = solidHydration({ plugins: [counter] });
  const config = (plugin.config as unknown as () => { test: { browser: { commands: { serverRender: Command } } } })();
  const closers: Array<() => Promise<void>> = [];
  (plugin.configureVitest as unknown as (context: unknown) => void)({
    vitest: { onClose: (close: () => Promise<void>) => closers.push(close) },
  });

  return {
    close: async () => {
      for (const close of closers) await close();
    },
    config,
    opened: () => opened,
    serverRender: config.test.browser.commands.serverRender,
  };
}

const open: Wired[] = [];

afterEach(async () => {
  for (const wired of open.splice(0)) await wired.close();
  vi.restoreAllMocks();
});

describe("solidHydration", () => {
  it("adds the serverRender command and nothing else to the project", () => {
    const wired = wire();
    open.push(wired);
    expect(wired.config).toEqual({
      test: { browser: { commands: { serverRender: wired.serverRender } } },
    });
    expect(solidHydration().name).toBe("@workerstack/testing/web/solid");
  });

  it("renders a fixture's export on the server, hydratable, with its warnings, on one server", async () => {
    const wired = wire();
    open.push(wired);
    const greeting = await wired.serverRender(CONTEXT, FIXTURE, "Greeting");
    expect(greeting.html).toContain('data-slot="greeting"');
    expect(greeting.html).toContain("Hello &amp; welcome");
    expect(greeting.html).toMatch(/ _hk=/);
    expect(greeting.warnings).toEqual([]);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect((await wired.serverRender(CONTEXT, FIXTURE, "Warns")).warnings).toEqual(["rendered with a warning"]);
    expect(wired.opened()).toBe(1);
  });

  it("says which export is missing", async () => {
    const wired = wire();
    open.push(wired);
    await expect(wired.serverRender(CONTEXT, FIXTURE, "Nope")).rejects.toThrow(
      `solidHydration: ${FIXTURE} exports no Nope`,
    );
  });

  it("closes its server when vitest closes, and opens a new one if asked again", async () => {
    const wired = wire();
    await wired.close();
    expect(wired.opened()).toBe(0);
    await wired.serverRender(CONTEXT, FIXTURE, "Greeting");
    await wired.close();
    await wired.serverRender(CONTEXT, FIXTURE, "Greeting");
    await wired.close();
    expect(wired.opened()).toBe(2);
  });
});
