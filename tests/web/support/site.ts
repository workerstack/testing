import {
	test as base,
	type Fixtures,
	type PlaywrightTestArgs,
	type PlaywrightTestOptions,
	type PlaywrightWorkerArgs,
	type PlaywrightWorkerOptions,
} from "@playwright/test"
import { servePages } from "./pages.ts"

/*
 * The fixture pages under tests/web/pages, served per worker on a port the OS picks. Nothing here
 * has a fixed port, so two runs side by side never collide and a run never needs a retry.
 */

/** A running fixture site: its origin, and the port its socket is bound to. */
export interface Site {
	url: string
	port: number
}

/** The worker's `site`, and a `baseURL` pointing at it; any Playwright `test` extends with these. */
export const siteFixtures: Fixtures<
	object,
	{ site: Site },
	PlaywrightTestArgs & PlaywrightTestOptions,
	PlaywrightWorkerArgs & PlaywrightWorkerOptions
> = {
	site: [
		// oxlint-disable-next-line no-empty-pattern -- Playwright reads a fixture's dependencies from this pattern; `{}` is none
		async ({}, use) => {
			const { close, port } = await servePages({ host: "127.0.0.1", port: 0 })
			try {
				await use({ port, url: `http://127.0.0.1:${port}` })
			} finally {
				await close()
			}
		},
		{ scope: "worker" },
	],
	baseURL: async ({ site }, use) => use(site.url),
}

export const test = base.extend<object, { site: Site }>(siteFixtures)

export { expect } from "@playwright/test"
