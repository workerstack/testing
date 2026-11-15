import { expect, test } from "../support.ts"

test("a script from an undeclared origin fails the test", async ({ page }) => {
	await page.goto("/external.html")
})

test("an allowed origin answers with its stub, across origins", async ({ network, page }) => {
	network.allow("https://tiles.example.invalid", { fulfill: { json: { name: "stubbed tiles" } } })
	await page.goto("/tiles.html")
	await expect(page.locator("output")).toHaveText("stubbed tiles")
})

test("a page.route stub answers before the gate", async ({ page }) => {
	await page.route("https://tiles.example.invalid/**", (route) =>
		route.fulfill({ headers: { "access-control-allow-origin": "*" }, json: { name: "page stub" } }),
	)
	await page.goto("/tiles.html")
	await expect(page.locator("output")).toHaveText("page stub")
})

test("allow refuses a path where an origin belongs", async ({ network }) => {
	network.allow("https://tiles.example.invalid/tiles.json")
})
