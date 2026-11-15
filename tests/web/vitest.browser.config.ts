import { playwright } from "@vitest/browser-playwright";
import { defineProject } from "vitest/config";

import { freePort } from "../../src/web/port.ts";

/* In-page helpers in real Chromium. The browser server takes a port the OS picked, never vitest's fixed default. */
export default defineProject({
  test: {
    name: "web",
    include: ["browser/**/*.test.ts"],
    api: { port: await freePort() },
    browser: { enabled: true, headless: true, instances: [{ browser: "chromium" }], provider: playwright() },
  },
});
