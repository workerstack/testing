import { hydrator, tag } from "@workerstack/testing/web/solid";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import { Counter, Drifts } from "./button.fixture.tsx";

const FIXTURE = new URL("./button.fixture.tsx", import.meta.url);
const hydrate = hydrator(FIXTURE, { Counter, Drifts });

describe("a packed consumer", () => {
  it("hydrates a clean button and reads its server HTML", async () => {
    const view = await hydrate("Counter");
    expect(view.mismatches).toEqual({});
    expect(tag(view.server.html, { "data-slot": "counter" }).text).toBe("Count 0");
    await userEvent.click(page.getByRole("button", { name: "Count 0" }));
    await expect.element(page.getByRole("button", { name: "Count 1" })).toBeInTheDocument();
  });

  it("reports the element the server rendered differently", async () => {
    const view = await hydrate("Drifts");
    expect(view.mismatches.warnings).toEqual([
      'Hydration tag mismatch for key "1": expected <i> but found <b _hk="1">',
    ]);
  });

  it("rejects with the plugin's line when a fixture has no such export", async () => {
    await expect(hydrator(FIXTURE, { Missing: Counter })("Missing")).rejects.toThrow(
      "solidHydration: /button.fixture.tsx exports no Missing",
    );
  });
});
