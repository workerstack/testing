import { expect, test } from "@workerstack/testing/web";

/* Each test may land on either worker; every one reaches the server the main process started. */

test("baseURL is the server on the port the main process kept", ({ baseURL }) => {
  expect(baseURL).toBe(`http://localhost:${process.env["WORKERSTACK_WEB_PORT_APP"]}`);
});

test("ready.goto opens the app's home page", async ({ page, ready }) => {
  await ready.goto("/", { marker: "main h1" });
  await expect(page.locator("h1")).toHaveText("Fixture page");
});

test("the network gate trusts the server and passes an allowed stub", async ({ page, network }) => {
  network.allow("https://tiles.example.invalid", { fulfill: { json: { name: "server tiles" } } });
  await page.goto("/tiles.html");
  await expect(page.locator("output")).toHaveText("server tiles");
});

test("a page that becomes usable late reaches its marker", async ({ page, ready }) => {
  await ready.goto("/late.html", { marker: "html[data-hydrated]" });
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "");
});
