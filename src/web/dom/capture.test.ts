import { beforeEach, describe, expect, it, vi } from "vitest";

import { hold } from "./capture.ts";

// Node has no Element: each test gets a bare one whose native capture calls are recorded.
let native: string[];

beforeEach(() => {
  native = [];
  vi.stubGlobal(
    "Element",
    class {
      setPointerCapture(id: number): void {
        native.push(`set ${id}`);
      }
      hasPointerCapture(id: number): boolean {
        native.push(`has ${id}`);

        return false;
      }
      releasePointerCapture(id: number): void {
        native.push(`release ${id}`);
      }
    },
  );

  return () => vi.unstubAllGlobals();
});

describe("hold", () => {
  it("records the capture of a held pointer, which the browser would ignore or refuse", () => {
    const capture = hold(1);
    const row = new Element();
    const other = new Element();
    expect(capture.captor()).toBeNull();
    row.setPointerCapture(1);
    expect(capture.captor()).toBe(row);
    expect([row.hasPointerCapture(1), other.hasPointerCapture(1)]).toEqual([true, false]);
    other.releasePointerCapture(1);
    expect(capture.captor()).toBe(row);
    row.releasePointerCapture(1);
    expect(capture.captor()).toBeNull();
    expect(native).toEqual([]);
    capture.end();
  });

  it("leaves every other pointer, and a pointer once it is let go, to the browser", () => {
    const capture = hold(2);
    const row = new Element();
    row.setPointerCapture(1);
    row.hasPointerCapture(1);
    row.releasePointerCapture(1);
    capture.end();
    row.setPointerCapture(2);
    expect(capture.captor()).toBeNull();
    expect(native).toEqual(["set 1", "has 1", "release 1", "set 2"]);
  });

  it("hands a pointer pressed again to the new press, and the old hold ends without touching it", () => {
    const first = hold(1);
    const second = hold(1);
    const row = new Element();
    row.setPointerCapture(1);
    first.end();
    expect(second.captor()).toBe(row);
    expect(row.hasPointerCapture(1)).toBe(true);
    second.end();
    expect(native).toEqual([]);
  });
});
