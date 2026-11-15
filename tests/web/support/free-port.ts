import { createServer } from "node:net"

/**
 * A port the OS reports free on `localhost`, the host vitest's browser server binds. Vitest reads
 * `api.port: 0` as "use the default", 63315, so a config asks for a real free port this way.
 */
export function freePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const probe = createServer()
		probe.once("error", reject)
		probe.listen({ host: "localhost", port: 0 }, () => {
			const address = probe.address()
			const port = typeof address === "object" && address !== null ? address.port : 0
			probe.close(() => resolve(port))
		})
	})
}
