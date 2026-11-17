import { describe, expect, expectTypeOf, it } from "vitest";

import { FILE_ORDER, LINE_ORDER } from "./journal-order.ts";
import type { JournalExchangeFile, JournalIndexLine } from "./journal.ts";

// An exchange file and an index line state their fields in these orders, so each must name every
// field the record can carry, once: a field left out would make the journal throw as it writes.
describe("journal orders", () => {
  it("name every field an exchange file carries, once", () => {
    expectTypeOf<(typeof FILE_ORDER)[number]>().toEqualTypeOf<keyof JournalExchangeFile>();
    expect(new Set(FILE_ORDER).size).toBe(FILE_ORDER.length);
  });

  it("name every field an index line carries, once", () => {
    expectTypeOf<(typeof LINE_ORDER)[number]>().toEqualTypeOf<keyof JournalIndexLine>();
    expect(new Set(LINE_ORDER).size).toBe(LINE_ORDER.length);
  });
});
