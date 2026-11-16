import solid from "@solidjs/vite-plugin";
import { playwright } from "@vitest/browser-playwright";
import { solidHydration } from "@workerstack/testing/web/solid/vitest";
import { defineProject } from "vitest/config";

import { freePort } from "../../src/web/port.ts";

// Server HTML rendered in node by the plugin, hydrated in Chromium by the same fixtures compiled hydratable.
export default defineProject({
  plugins: [solid({ refresh: false, solid: { hydratable: true } }), solidHydration()],
  test: {
    name: "solid-hydration",
    include: ["solid/**/*.hydration.test.tsx"],
    api: { port: await freePort() },
    browser: { enabled: true, headless: true, instances: [{ browser: "chromium" }], provider: playwright() },
  },
});
