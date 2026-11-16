import { expect, test } from "../support.ts";

test("a marker that never shows fails with the page and the marker", async ({ ready }) => {
  await ready.goto("/index.html", { marker: "html[data-hydrated]", timeout: 500 });
});

test("goto waits for the marker, so the first click lands", async ({ page, ready }) => {
  await ready.goto("/late.html", { marker: "html[data-hydrated]" });
  await page.getByRole("button").click();
  await expect(page.getByRole("button")).toHaveText("clicked");
});

test("settle returns once finite animations end, past an infinite and a canceled one", async ({ page, ready }) => {
  // The canceled animation would run 10 s: settling well inside this proves it was not waited on.
  test.setTimeout(5000);
  await ready.goto("/animated.html", { marker: "html[data-started]" });
  const main = page.locator("main");

  // One read, no retry: what runs, and how wide the growing box is, at this moment.
  const now = (): Promise<{ running: string[]; width: string }> =>
    main.evaluate((element) => ({
      running: element
        .getAnimations({ subtree: true })
        .filter((animation) => animation.playState === "running")
        .map((animation) => animation.constructor.name)
        .toSorted(),
      width: getComputedStyle(element.querySelector("#grow") as Element).width,
    }));

  expect((await now()).running).toEqual(["Animation", "CSSAnimation", "CSSTransition"]);
  await ready.settle(main);
  expect(await now()).toEqual({ running: ["CSSAnimation"], width: "300px" });
});
