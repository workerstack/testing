import { playwright } from "@vitest/browser-playwright";
import { defineProject } from "vitest/config";

import { freePort } from "../../src/web/port.ts";

// In-page helpers in real Chromium. The browser server takes a port the OS picked, never vitest's fixed default.
export default defineProject({
  test: {
    api: { port: await freePort() },
    browser: { enabled: true, headless: true, instances: [{ browser: "chromium" }], provider: playwright() },
    include: ["browser/**/*.test.ts"],
    name: "web",
  },
});
