import { test } from "../support.ts";

test("a clean page passes the accessibility scan", async ({ a11y, page }) => {
  await page.goto("/");
  await a11y.check();
});

test("an image with no alt fails the scan with the rule and the node", async ({ a11y, page }) => {
  await page.goto("/a11y-bad.html");
  await a11y.check();
});

test.describe(() => {
  test.use({ a11yDefaults: { exclude: [{ reason: "a decorative pixel the design keeps", selector: "img" }] } });

  test("an excluded image passes when the exclude says why", async ({ a11y, page }) => {
    await page.goto("/a11y-bad.html");
    await a11y.check();
  });
});

test("an exclude with a blank reason fails before it scans", async ({ a11y, page }) => {
  await page.goto("/a11y-bad.html");
  await a11y.check({ exclude: [{ reason: "", selector: "img" }] });
});
