import { relative } from "node:path";

import type { AxeBuilder } from "@axe-core/playwright";
import type {
  BrowserContext,
  Fixtures,
  Page,
  PlaywrightTestArgs,
  PlaywrightTestOptions,
  PlaywrightWorkerArgs,
  PlaywrightWorkerOptions,
  TestInfo,
} from "@playwright/test";

import { createA11y, loadAxe, type A11y, type A11yOptions } from "./a11y.ts";
import { breaches, breachLine, checkGuard, type GuardIgnore, type GuardOptions, type PageEvent } from "./guard.ts";
import { createNetwork, type Network } from "./network.ts";
import { createPointer, type PagePointer } from "./pointer.ts";
import { createReady, type Ready } from "./ready.ts";

// The fixtures `test` adds to Playwright's: the page a test drives is guarded, every request it
// makes passes the network gate, and the readiness, a11y and pointer helpers act on that page. A consumer
// sets `guard` and `a11yDefaults` with `test.use` per file or per describe.

export type WebFixtures = {
  /** What the page may say without failing the test. */
  guard: GuardOptions;
  /** Waits on the page's own markers and animations instead of the clock. */
  ready: Ready;
  /** What every `a11y.check` in scope excludes or skips, before the call's own options. */
  a11yDefaults: A11yOptions;
  /** Scans the page for WCAG 2.2 AA violations. */
  a11y: A11y;
  /** Declares the origins the page may reach beyond the app's own. */
  network: Network;
  /** Drags with the page's mouse, one animation frame per step. */
  pointer: PagePointer;
};

type TestArgs = PlaywrightTestArgs & PlaywrightTestOptions;

type WorkerArgs = PlaywrightWorkerArgs & PlaywrightWorkerOptions;

const pathOf = (url: string): string => new URL(url).pathname;

// Chromium logs each request the network gate aborts; the gate's own line already names it.
const GATE_BLOCKED: GuardIgnore = {
  kind: "error",
  reason: "the network gate reports the blocked request itself",
  text: "Failed to load resource: net::ERR_BLOCKED_BY_CLIENT",
};

/**
 * Hands the test its page and records what the page says. After the test, every breach fails it
 * in one error, one line each; a reasonless ignore fails it before it runs.
 */
export async function guardPage(
  { guard, page }: { guard: GuardOptions; page: Page },
  use: (page: Page) => Promise<void>,
  testInfo: TestInfo,
): Promise<void> {
  const { ignore = [], ...rest } = checkGuard(guard);
  const options: GuardOptions = { ...rest, ignore: [...ignore, GATE_BLOCKED] };
  const events: PageEvent[] = [];
  page.on("console", (message) =>
    events.push({ kind: message.type(), path: pathOf(page.url()), text: message.text() }),
  );
  page.on("pageerror", (error) => events.push({ kind: "pageerror", path: pathOf(page.url()), text: error.message }));
  await use(page);
  const where = `${relative(testInfo.project.testDir, testInfo.file)}:${testInfo.line}`;
  const lines = breaches(events, options).map((event) => breachLine(event, where));

  if (lines.length > 0) throw new Error(lines.join("\n"));
}

/** A real axe scan of `page`, from the optional peer. */
export async function buildAxe(page: Page): Promise<AxeBuilder> {
  return new (await loadAxe())({ page });
}

/**
 * Routes every request of the test's context through the network gate before the page loads.
 * After the test, every blocked request fails it in one error, one line each.
 */
export async function guardNetwork(
  { baseURL, context }: { baseURL: string | undefined; context: BrowserContext },
  use: (network: Network) => Promise<void>,
): Promise<void> {
  const gate = createNetwork({ firstParty: baseURL });
  await context.route("**/*", (route) => gate.handle(route));
  await use(gate.network);
  const lines = gate.breaches();

  if (lines.length > 0) throw new Error(lines.join("\n"));
}

export const fixtures: Fixtures<WebFixtures, object, TestArgs, WorkerArgs> = {
  guard: [{}, { option: true }],
  page: guardPage,
  ready: async ({ page }, use) => use(createReady(page)),
  a11yDefaults: [{}, { option: true }],
  a11y: async ({ a11yDefaults, page }, use) => use(createA11y({ builder: buildAxe, defaults: a11yDefaults, page })),
  network: [guardNetwork, { auto: true }],
  pointer: async ({ page }, use) => use(createPointer(page)),
};
