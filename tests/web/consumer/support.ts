import { test as web } from "@workerstack/testing/web";

import { type Site, siteFixtures } from "../support/site.ts";

/* What a consumer writes once: the package's `test`, extended with where its app is served. */
export const test = web.extend<object, { site: Site }>(siteFixtures);

export { expect } from "@workerstack/testing/web";
