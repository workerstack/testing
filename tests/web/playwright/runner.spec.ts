import { expect, test } from "../support/site.ts";

test("loads the fixture page from the site the worker started on a port the OS picked", async ({
  baseURL,
  page,
  site,
}) => {
  expect(new URL(baseURL ?? "").port).toBe(String(site.port));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Fixture page");
});
