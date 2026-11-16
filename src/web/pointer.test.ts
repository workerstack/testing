import type { Locator, Page } from "@playwright/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Box } from "./dom/gesture.ts";
import { createPointer } from "./pointer.ts";

// The page's frame is node's next tick here: `evaluate` runs the function it is given, as the page would.
beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (done: () => void) => setTimeout(done, 0));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// A page whose mouse and frames write to one log, in the order the pointer drives them.
function fakePage(): { page: Page; log: string[] } {
  const log: string[] = [];

  const page = {
    evaluate: async (inPage: () => Promise<void>) => {
      await inPage();
      log.push("frame");
    },
    mouse: {
      down: async () => {
        log.push("down");
      },
      move: async (x: number, y: number) => {
        log.push(`move ${x},${y}`);
      },
      up: async () => {
        log.push("up");
      },
    },
  };

  return { log, page: page as unknown as Page };
}

function locator(name: string, box: Box | null, log: string[] = []): Locator {
  const fake = {
    boundingBox: async () => box,
    scrollIntoViewIfNeeded: async () => {
      log.push(`scroll ${name}`);
    },
    toString: () => `locator('${name}')`,
  };

  return fake as unknown as Locator;
}

const A = { height: 20, width: 100, x: 0, y: 0 };
const C = { height: 20, width: 100, x: 0, y: 100 };

describe("createPointer(page).drag", () => {
  it("scrolls the handle in, presses its center, lifts, walks to the target's center with a frame per step, releases", async () => {
    const { log, page } = fakePage();
    await createPointer(page).drag(locator("a", A, log), { to: locator("c", C) });
    expect(log.slice(0, 4)).toEqual(["scroll a", "move 50,10", "down", "move 53,10"]);
    expect(log.filter((entry) => entry === "frame")).toHaveLength(18);
    expect(log.filter((entry) => entry.startsWith("move"))).toHaveLength(19);
    expect(log.slice(-3)).toEqual(["move 56,110", "frame", "up"]);
    const steps = log.slice(log.indexOf("down") + 1, -1);
    expect(steps.every((entry, index) => (index % 2 === 0 ? entry.startsWith("move") : entry === "frame"))).toBe(true);
  });

  it("walks to a spot along a horizontal list in the steps it is given", async () => {
    const { log, page } = fakePage();
    await createPointer(page).drag(locator("a", A), { axis: "x", steps: 2, to: { x: 300, y: 10 } });
    expect(log.filter((entry) => entry.startsWith("move")).slice(-1)).toEqual(["move 300,16"]);
    expect(log.filter((entry) => entry === "frame")).toHaveLength(4);
  });

  it("measures the target after the handle scrolls in", async () => {
    const log: string[] = [];
    const { log: moves, page } = fakePage();
    const target = { ...C };
    const handle = locator("a", A, log);
    const scrolled = { ...handle, scrollIntoViewIfNeeded: async () => void (target.y = 40) } as unknown as Locator;
    await createPointer(page).drag(scrolled, { to: locator("c", target) });
    expect(moves.filter((entry) => entry.startsWith("move")).at(-1)).toBe("move 56,50");
  });

  it("names a locator that has no box, before it presses", async () => {
    const { log, page } = fakePage();
    await expect(createPointer(page).drag(locator("a", A), { to: locator("gone", null) })).rejects.toThrow(
      "pointer: locator('gone') has no box; is it visible?",
    );
    expect(log).toEqual([]);
  });
});

describe("createPointer(page).dragCenterTo", () => {
  it("grips the handle so the item's center, not the handle's, lands on the spot", async () => {
    const { log, page } = fakePage();
    const handle = locator("handle", { height: 10, width: 10, x: 0, y: 0 });
    const item = locator("item", { height: 40, width: 100, x: 0, y: 0 });
    await createPointer(page).dragCenterTo({ handle, item, to: { x: 50, y: 200 } });
    expect(log[0]).toBe("move 5,5");
    expect(log.filter((entry) => entry.startsWith("move")).at(-1)).toBe("move 11,185");
  });
});
