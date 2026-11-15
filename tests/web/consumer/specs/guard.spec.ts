import { solidMismatches } from "@workerstack/testing/web/solid";

import { expect, test } from "../support.ts";

test("a clean page passes", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Fixture page");
});

test("a console error fails the test", async ({ page }) => {
  await page.goto("/console-error.html");
});

test("a page error fails the test", async ({ page }) => {
  await page.goto("/page-error.html");
});

test.describe(() => {
  test.use({ guard: { ignore: [{ text: /ResizeObserver loop/, reason: "browser noise, no app impact" }] } });

  test("noise passes when an ignore says why", async ({ page }) => {
    await page.goto("/noise.html");
  });
});

test.describe(() => {
  test.use({ guard: { fail: solidMismatches } });

  test("a Solid hydration mismatch fails the test under solidMismatches", async ({ page }) => {
    await page.goto("/hydration-mismatch.html");
  });
});

test.describe(() => {
  test.use({ guard: { ignore: [{ text: /ResizeObserver loop/, reason: " " }] } });

  test("an ignore with a blank reason fails before the test runs", async ({ page }) => {
    await page.goto("/noise.html");
  });
});
