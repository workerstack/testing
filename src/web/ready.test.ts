import { errors, type Locator, type Page } from "@playwright/test";
import { describe, expect, it } from "vitest";

import { createReady, settleAnimations } from "./ready.ts";

interface Calls {
  goto: string[];
  waits: Array<{ marker: string; state: string; timeout: number }>;
  evaluated: unknown[];
}

/* A page whose marker shows up, or times out as Playwright's own wait does. */
function fakePage(shows: boolean | Error): { page: Page; calls: Calls } {
  const calls: Calls = { evaluated: [], goto: [], waits: [] };
  const page = {
    goto: async (path: string) => {
      calls.goto.push(path);
      return null;
    },
    locator: (marker: string) => ({
      waitFor: async (options: { state: string; timeout: number }) => {
        calls.waits.push({ marker, ...options });
        if (shows instanceof Error) throw shows;
        if (!shows) throw new errors.TimeoutError(`locator.waitFor: Timeout ${options.timeout}ms exceeded.`);
      },
    }),
  };
  return { calls, page: page as unknown as Page };
}

describe("ready.goto", () => {
  it("opens the path, then waits for the marker to be in the page", async () => {
    const { calls, page } = fakePage(true);
    await createReady(page).goto("/", { marker: "html[data-hydrated]" });
    expect(calls.goto).toEqual(["/"]);
    expect(calls.waits).toEqual([{ marker: "html[data-hydrated]", state: "attached", timeout: 5000 }]);
  });

  it("says which page never showed which marker", async () => {
    const { page } = fakePage(false);
    await expect(createReady(page).goto("/late.html", { marker: "html[data-hydrated]" })).rejects.toThrow(
      "ready.goto: /late.html never showed html[data-hydrated] (timeout 5000ms)",
    );
    await expect(createReady(page).goto("/late.html", { marker: "main", timeout: 250 })).rejects.toThrow(
      "ready.goto: /late.html never showed main (timeout 250ms)",
    );
  });

  it("lets any other failure through as it is", async () => {
    const closed = new Error("locator.waitFor: Target page, context or browser has been closed");
    await expect(createReady(fakePage(closed).page).goto("/", { marker: "main" })).rejects.toBe(closed);
  });
});

describe("ready.settle", () => {
  it("runs the settle function in the page on the element", async () => {
    const calls: unknown[] = [];
    const locator = {
      evaluate: async (fn: unknown) => {
        calls.push(fn);
      },
    } as unknown as Locator;
    await createReady(fakePage(true).page).settle(locator);
    expect(calls).toEqual([settleAnimations]);
  });
});

interface FakeAnimation {
  playState: string;
  effect: { getComputedTiming: () => { endTime: number } } | null;
  finished: Promise<unknown>;
}

const animation = (playState: string, endTime: number, finished: Promise<unknown>): FakeAnimation => ({
  effect: { getComputedTiming: () => ({ endTime }) },
  finished,
  playState,
});

/* An element whose animations change from one look to the next, in a window whose frames run at once. */
function fakeElement(looks: FakeAnimation[][]): { element: Element; frames: () => number; looked: () => number } {
  let look = 0;
  let frames = 0;
  const element = {
    getAnimations: (options: { subtree: boolean }) => {
      expect(options).toEqual({ subtree: true });
      return looks[Math.min(look++, looks.length - 1)] ?? [];
    },
    ownerDocument: {
      defaultView: {
        requestAnimationFrame: (callback: () => void) => {
          frames += 1;
          callback();
        },
      },
    },
  };
  return { element: element as unknown as Element, frames: () => frames, looked: () => look };
}

describe("settleAnimations", () => {
  it("waits for every running finite animation, then a frame, then looks again", async () => {
    let finish: (() => void) | undefined;
    const finite = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const { element, frames, looked } = fakeElement([[animation("running", 400, finite)], []]);
    let settled = false;
    const settling = settleAnimations(element).then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    finish?.();
    await settling;
    expect(looked()).toBe(2);
    expect(frames()).toBe(2);
  });

  it("does not wait on an infinite, paused or finished animation", async () => {
    const never = new Promise(() => {});
    const { element, looked } = fakeElement([
      [animation("running", Infinity, never), animation("paused", 400, never), animation("finished", 400, never)],
    ]);
    await settleAnimations(element);
    expect(looked()).toBe(1);
  });

  it("counts a canceled animation as done", async () => {
    const canceled = Promise.reject(new DOMException("The user aborted a request.", "AbortError"));
    const { element } = fakeElement([[animation("running", 400, canceled)], []]);
    await expect(settleAnimations(element)).resolves.toBeUndefined();
  });

  it("waits for a running animation with no effect, which ends at once", async () => {
    const bare = { effect: null, finished: Promise.resolve(), playState: "running" };
    const { element, looked } = fakeElement([[bare], []]);
    await settleAnimations(element);
    expect(looked()).toBe(2);
  });

  it("returns at once for an element outside any window", async () => {
    const element = { ownerDocument: { defaultView: null } } as unknown as Element;
    await expect(settleAnimations(element)).resolves.toBeUndefined();
  });
});
