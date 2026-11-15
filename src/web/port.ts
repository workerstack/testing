import { createServer, type Server } from "node:net"

/**
 * A port the OS reports free on `localhost`, the host app and browser servers bind by default.
 * The probe is closed before this resolves, so the caller's server can take the port.
 */
export function freePort(create: () => Server = createServer): Promise<number> {
	return new Promise((resolve, reject) => {
		const probe = create()
		probe.once("error", reject)
		probe.listen({ host: "localhost", port: 0 }, () => {
			const address = probe.address()
			probe.close(() => {
				if (typeof address === "object" && address !== null) resolve(address.port)
				else reject(new Error("freePort: the probe on localhost has no port"))
			})
		})
	})
}
