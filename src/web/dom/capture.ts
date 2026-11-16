// Pointer capture for dispatched pointers. Chromium keeps no capture for a pointer that is not
// really down: `setPointerCapture` does nothing for the mouse, and throws NotFoundError for a touch
// id it never saw. While a dispatched pointer is held, the capture calls for its id are kept here
// instead, so its events go to the captor, as a browser sends a captured pointer's. Every other
// pointer, and this one once it is let go, goes to the browser's own methods.

/** Who holds a pressed pointer's capture, until the press ends. */
export type Capture = {
  /** The element that took the capture, or null. */
  captor(): Element | null;
  /** Lets the pointer go; its capture calls go to the browser again. */
  end(): void;
};

type Entry = {
  captor: Element | null;
};

type Held = Map<number, Entry>;

// The held pointers live on the prototype under a shared key, so two copies of this module in one page share them.
const HELD = /* @__PURE__ */ Symbol.for("@workerstack/testing/web/dom held pointers");

// Replaces the three capture methods; each defers to the browser's for a pointer not held.
function patch(proto: Element, held: Held): void {
  const native = {
    has: proto.hasPointerCapture,
    release: proto.releasePointerCapture,
    set: proto.setPointerCapture,
  };

  proto.setPointerCapture = function setPointerCapture(this: Element, id: number): void {
    const entry = held.get(id);

    if (entry === undefined) native.set.call(this, id);
    else entry.captor = this;
  };

  proto.hasPointerCapture = function hasPointerCapture(this: Element, id: number): boolean {
    const entry = held.get(id);

    return entry === undefined ? native.has.call(this, id) : entry.captor === this;
  };

  proto.releasePointerCapture = function releasePointerCapture(this: Element, id: number): void {
    const entry = held.get(id);

    if (entry === undefined) native.release.call(this, id);
    else if (entry.captor === this) entry.captor = null;
  };
}

/** The prototype's held pointers, patching its capture methods the first time. */
function heldOn(proto: Element & { [HELD]?: Held }): Held {
  const existing = proto[HELD];

  if (existing !== undefined) return existing;
  const held: Held = new Map();
  patch(proto, held);
  Object.defineProperty(proto, HELD, { value: held });

  return held;
}

/** Keeps pointer `id`'s capture from its press until `end`. A new press of the same id takes it over. */
export function hold(id: number): Capture {
  const held = heldOn(Element.prototype);
  const entry: Entry = { captor: null };
  held.set(id, entry);

  return {
    captor: () => entry.captor,
    end: () => {
      if (held.get(id) === entry) held.delete(id);
    },
  };
}
