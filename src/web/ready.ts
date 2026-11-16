import { errors, type Locator, type Page } from "@playwright/test";

// Waiting on what the page says it is, never on the clock. `goto` opens a path and waits for a
// marker the app sets once it is usable (hydrated, data loaded); `settle` waits until an element
// and everything under it stop animating, so a screenshot or a click lands on the final layout.

export type GotoOptions = {
  /** A selector the app puts in the page once it is ready, such as `html[data-hydrated]`. */
  marker: string;
  /** How long to wait for the marker, in milliseconds. Default 5000. */
  timeout?: number;
};

export type Ready = {
  /** Open `path`, then wait for `marker` to be in the page. */
  goto(path: string, options: GotoOptions): Promise<void>;
  /** Wait until the element's running animations, and those under it, have finished. */
  settle(locator: Locator): Promise<void>;
};

const DEFAULT_TIMEOUT_MS = 5000;

/** The readiness helpers for one page. */
export function createReady(page: Page): Ready {
  return {
    async goto(path, { marker, timeout = DEFAULT_TIMEOUT_MS }) {
      await page.goto(path);

      try {
        await page.locator(marker).waitFor({ state: "attached", timeout });
      } catch (error) {
        if (!(error instanceof errors.TimeoutError)) throw error;
        throw new Error(`ready.goto: ${path} never showed ${marker} (timeout ${timeout}ms)`, { cause: error });
      }
    },
    async settle(locator) {
      await locator.evaluate(settleAnimations);
    },
  };
}

/**
 * Runs in the page, so it reads nothing outside itself. Each pass waits for the running animations
 * that end (an infinite one never does; a paused one waits on the app), then a frame, in which a
 * finished animation may have started another, and looks again. A canceled animation counts as done.
 */
export async function settleAnimations(element: Element): Promise<void> {
  const view = element.ownerDocument.defaultView;

  if (view === null) return;
  let running: Animation[];

  do {
    running = element
      .getAnimations({ subtree: true })
      .filter(
        (animation) =>
          animation.playState === "running" && (animation.effect?.getComputedTiming().endTime ?? 0) !== Infinity,
      );
    await Promise.all(running.map((animation) => animation.finished.catch(() => {})));
    await new Promise<void>((resolve) => view.requestAnimationFrame(() => resolve()));
  } while (running.length > 0);
}
