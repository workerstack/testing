import {
  test as base,
  type PlaywrightTestArgs,
  type PlaywrightTestOptions,
  type PlaywrightWorkerArgs,
  type PlaywrightWorkerOptions,
  type TestType,
} from "@playwright/test";

import { fixtures, type WebFixtures } from "./fixtures.ts";

// Playwright's test with the web fixtures: a guarded page, the `guard` option and `ready`.
export const test: TestType<
  PlaywrightTestArgs & PlaywrightTestOptions & WebFixtures,
  PlaywrightWorkerArgs & PlaywrightWorkerOptions
> = /* @__PURE__ */ base.extend<WebFixtures>(fixtures);
