import { expect, test } from "../support.ts";

/* The `pointer` fixture against a page whose items follow a captured pointer and reorder on release. */

test("a drag reorders the list", async ({ page, pointer }) => {
  await page.goto("/list.html");
  await pointer.drag(page.locator("[data-item=a]"), { to: page.locator("[data-item=c]") });
  await expect(page.locator("li")).toHaveText(["b", "a", "c"]);
});

test("dragCenterTo lands the item past the last one", async ({ page, pointer }) => {
  await page.goto("/list.html");
  const item = page.locator("[data-item=a]");
  const box = await page.locator("[data-item=c]").boundingBox();
  if (box === null) throw new Error("the last item has no box");
  const to = { x: box.x + box.width / 2, y: box.y + box.height + 6 };
  await pointer.dragCenterTo({ handle: item.locator(".grip"), item, to });
  await expect(page.locator("li")).toHaveText(["b", "c", "a"]);
});
