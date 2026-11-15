import {
	test as base,
	type Fixtures,
	type PlaywrightTestArgs,
	type PlaywrightTestOptions,
	type PlaywrightWorkerArgs,
	type PlaywrightWorkerOptions,
} from "@playwright/test"
import { readFile } from "node:fs/promises"
import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { extname, join, normalize } from "node:path"

/*
 * The fixture pages under tests/web/pages, served per worker on a port the OS picks. Nothing here
 * has a fixed port, so two runs side by side never collide and a run never needs a retry.
 */

const PAGES = join(import.meta.dirname, "..", "pages")
const TYPES: Readonly<Record<string, string>> = {
	".css": "text/css",
	".html": "text/html; charset=utf-8",
	".js": "text/javascript",
	".png": "image/png",
}

/** A running fixture site: its origin, and the port its socket is bound to. */
export interface Site {
	url: string
	port: number
}

async function serve(): Promise<{ site: Site; close: () => Promise<void> }> {
	const server = createServer((request, response) => {
		const path = normalize(new URL(request.url ?? "/", "http://site").pathname).replace(/\/$/, "/index.html")
		readFile(join(PAGES, path))
			.then((body) =>
				response.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" }).end(body),
			)
			.catch(() => response.writeHead(404).end())
	})
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
	const { port } = server.address() as AddressInfo
	const close = (): Promise<void> =>
		new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
	return { close, site: { port, url: `http://127.0.0.1:${port}` } }
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
			const { close, site } = await serve()
			try {
				await use(site)
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
