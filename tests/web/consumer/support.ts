import type {
  PlaywrightTestArgs,
  PlaywrightTestOptions,
  PlaywrightWorkerArgs,
  PlaywrightWorkerOptions,
  TestType,
} from "@playwright/test";
import { test as web, type WebFixtures } from "@workerstack/testing/web";

import { type Site, siteFixtures } from "../support/site.ts";

// What a consumer writes once: the package's `test`, extended with where its app is served.
export const test: TestType<
  PlaywrightTestArgs & PlaywrightTestOptions & WebFixtures,
  PlaywrightWorkerArgs & PlaywrightWorkerOptions & { site: Site }
> = web.extend<object, { site: Site }>(siteFixtures);

export { expect } from "@workerstack/testing/web";
