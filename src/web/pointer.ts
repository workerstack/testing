import type { Locator, Page } from "@playwright/test";

import { centerOf, dragPath, gripTarget, type Axis, type Spot } from "./dom/gesture.ts";

/*
 * The `pointer` fixture: drags on Playwright's mouse along the same path the in-page pointer walks,
 * one page animation frame after each step, so a drag engine sees the moves a hand makes and not one
 * jump. It is a mouse; a touch gesture runs in the page, with `@workerstack/testing/web/dom`.
 */

/** A drag's target and pace. */
export interface PageDragOptions {
  /** A locator, whose center the drag ends on, or a spot in the viewport. */
  to: Locator | Spot;
  /** The list's main axis. @default "y" */
  axis?: Axis;
  /** Steps from the lift to the target. @default 16 */
  steps?: number;
}

/** A drag by a handle until its item's center sits on `to`, since a handle is rarely centered. */
export interface PageCenterDrag {
  handle: Locator;
  item: Locator;
  to: Spot;
  axis?: Axis;
}

export interface PagePointer {
  /** Presses the handle's center, lifts, walks to `to` kept 6px off-axis, and releases. */
  drag(handle: Locator, options: PageDragOptions): Promise<void>;
  /** Drags by the handle until the item's center sits on `to`. */
  dragCenterTo(input: PageCenterDrag): Promise<void>;
}

async function centerOfLocator(locator: Locator): Promise<Spot> {
  const box = await locator.boundingBox();
  if (box === null) throw new Error(`pointer: ${String(locator)} has no box; is it visible?`);
  return centerOf(box);
}

const nextFrame = (page: Page): Promise<void> =>
  page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));

/** The pointer fixture on `page`. */
export function createPointer(page: Page): PagePointer {
  const walk = async (from: Spot, options: Omit<PageDragOptions, "to"> & { to: Spot }): Promise<void> => {
    const { path, press } = dragPath({ ...options, from });
    await page.mouse.move(press.x, press.y);
    await page.mouse.down();
    for (const spot of path) {
      await page.mouse.move(spot.x, spot.y);
      await nextFrame(page);
    }
    await page.mouse.up();
  };
  /* The handle scrolls in first, so every box is measured where the drag will find it. */
  return {
    drag: async (handle, { to, ...pace }) => {
      await handle.scrollIntoViewIfNeeded();
      const target = "boundingBox" in to ? await centerOfLocator(to) : to;
      await walk(await centerOfLocator(handle), { ...pace, to: target });
    },
    dragCenterTo: async ({ handle, item, to, ...pace }) => {
      await handle.scrollIntoViewIfNeeded();
      const grip = await centerOfLocator(handle);
      const middle = await centerOfLocator(item);
      await walk(grip, { ...pace, to: gripTarget({ grip, middle, to }) });
    },
  };
}
