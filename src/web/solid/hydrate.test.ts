import { describe, expect, it } from "vitest";

import { hydrator } from "./hydrate.ts";

describe("hydrator", () => {
  it("says it runs in vitest's browser mode when a node test calls it", async () => {
    const hydrate = hydrator(new URL("http://localhost/button.fixture.tsx"), { ButtonFixture: () => "x" as never });
    const failed = await hydrate("ButtonFixture").catch((error: unknown) => error as Error);
    expect(failed).toBeInstanceOf(Error);
    expect((failed as Error).message).toBe("hydrate: runs in vitest's browser mode; this test runs in node");
    expect(String((failed as Error).cause)).toContain("vitest/browser can be imported only inside the Browser Mode");
  });
});
