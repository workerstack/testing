/** `defineConfig`: the typed entry point of a config file. */

import type { ApiConfig } from "../types/config.ts"

/**
 * Identity function that gives a config file full type checking and editor completion.
 *
 * ```ts
 * import { defineConfig, env } from "@workerstack/testing/api"
 *
 * export default defineConfig({
 *   spec: "https://api.example.com/openapi.json",
 *   baseUrl: "https://api.example.com",
 *   security: { bearer: { static: env("TOKEN") } },
 *   principals: { alpha: { tenant: "acme" } },
 * })
 * ```
 */
export function defineConfig(config: ApiConfig): ApiConfig {
	return config
}
