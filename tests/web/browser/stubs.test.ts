import { stubs } from "@workerstack/testing/web/dom";
import { describe, expect, it } from "vitest";

// The built `./web/dom` stubs in real Chromium, where every API they replace already exists.
const native = {
  animate: Element.prototype.animate,
  getClientRects: Range.prototype.getClientRects,
  matchMedia: window.matchMedia,
  PointerEvent: window.PointerEvent,
  ResizeObserver: window.ResizeObserver,
};

describe("stubs in Chromium", () => {
  it("replace the real APIs inside the test that installs them", () => {
    stubs.resizeObserver();
    stubs.matchMedia((query) => query.includes("reduce"));
    stubs.pointerEvent();
    stubs.animate();
    expect(window.ResizeObserver).not.toBe(native.ResizeObserver);
    expect(window.matchMedia("(prefers-reduced-motion: reduce)").matches).toBe(true);
    expect(window.PointerEvent).not.toBe(native.PointerEvent);
    expect(document.body.animate([{ opacity: 0 }, { opacity: 1 }], 10_000).playState).toBe("finished");
  });

  it("are gone in the next test, with the real APIs back", () => {
    expect(window.ResizeObserver).toBe(native.ResizeObserver);
    expect(window.matchMedia).toBe(native.matchMedia);
    expect(window.PointerEvent).toBe(native.PointerEvent);
    expect(Element.prototype.animate).toBe(native.animate);
    expect(window.matchMedia("(prefers-reduced-motion: reduce)").matches).toBe(false);
  });

  it("undo early through restore, and the undo after the test then does nothing", () => {
    const restore = stubs.rangeRects();
    expect(document.createRange().getClientRects()).toHaveLength(0);
    restore();
    expect(Range.prototype.getClientRects).toBe(native.getClientRects);
  });
});
