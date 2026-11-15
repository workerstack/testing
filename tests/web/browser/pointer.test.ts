import { pointer } from "@workerstack/testing/web/dom";
import { afterEach, describe, expect, it } from "vitest";

/*
 * The built `./web/dom` pointer against real Chromium: real pointer events, real hit testing,
 * real animation frames. A row follows the pointer only while it is pressed, as a drag engine does.
 */

function row(name: string, top: number): HTMLElement {
  const el = document.createElement("div");
  el.dataset["row"] = name;
  el.style.cssText = `position:absolute;left:0;top:${top}px;width:200px;height:40px;touch-action:none`;
  return el;
}

function stage(): { list: HTMLElement; a: HTMLElement; c: HTMLElement } {
  const list = document.createElement("div");
  list.style.cssText = "position:relative;width:200px;height:300px";
  const a = row("a", 0);
  const c = row("c", 200);
  list.append(a, c);
  document.body.append(list);
  return { a, c, list };
}

/* Makes `el` follow the pointer on the y axis from its press until its release. */
function follow(el: HTMLElement): void {
  let start: number | null = null;
  el.addEventListener("pointerdown", (event) => {
    el.setPointerCapture(event.pointerId);
    start = event.clientY;
  });
  el.addEventListener("pointermove", (event) => {
    if (start !== null) el.style.transform = `translate(0px, ${event.clientY - start}px)`;
  });
  el.addEventListener("pointerup", () => {
    start = null;
  });
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("pointer in Chromium", () => {
  it("drags a pressed row with real events, one frame per move, and clicks once on release", async () => {
    const { a, c, list } = stage();
    let frame = 0;
    let counting = true;
    const tick = (): void => {
      frame += 1;
      if (counting) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    const moveFrames: number[] = [];
    a.addEventListener("pointermove", () => moveFrames.push(frame));
    follow(a);
    const clicks: EventTarget[] = [];
    list.addEventListener("click", (event) => clicks.push(event.currentTarget as EventTarget));

    await pointer.drag(a, { to: c });
    counting = false;

    expect(moveFrames).toHaveLength(18);
    expect(new Set(moveFrames).size).toBe(18);
    expect(a.getBoundingClientRect().y).toBe(c.getBoundingClientRect().y);
    expect(clicks).toEqual([list]);
  });

  it("drags by a handle so the item's center lands on a spot past the last row", async () => {
    const { a, c } = stage();
    const handle = document.createElement("span");
    handle.style.cssText = "position:absolute;left:4px;top:4px;width:10px;height:10px";
    a.append(handle);
    follow(a);
    const to = pointer.beside(c, "after");
    await pointer.dragCenterTo({ handle, item: a, to });
    expect(pointer.centerOf(a).y).toBe(to.y);
  });

  it("drags with a touch whose handler takes capture, which Chromium refuses for a sent touch", async () => {
    const { a, c } = stage();
    follow(a);
    const touch = pointer.create("touch");
    await touch.lift(pointer.centerOf(a));
    await touch.move(pointer.centerOf(c), 8);
    touch.up();
    expect(a.getBoundingClientRect().y).toBe(c.getBoundingClientRect().y);
  });

  it("sends a touch with its own pointer type and no click", async () => {
    const { a, list } = stage();
    const seen: string[] = [];
    a.addEventListener("pointerdown", (event) => seen.push(event.pointerType));
    list.addEventListener("click", () => seen.push("click"));
    const touch = pointer.create("touch");
    touch.down(pointer.centerOf(a));
    touch.up();
    await pointer.frames(2);
    expect(seen).toEqual(["touch"]);
  });
});
