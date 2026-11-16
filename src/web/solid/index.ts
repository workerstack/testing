// `@workerstack/testing/web/solid`: server HTML read with a real parser, warnings recorded while
// they still print, Solid's mismatch messages for the page guard, and hydration over server HTML.
// The vite plugin a hydration project needs is `@workerstack/testing/web/solid/vitest`.
export { type Tag, type TagMatch, tag, tags, text } from "./html.ts";

export { hydrator } from "./hydrate.ts";

export type { Hydrated, MismatchKind, Mismatches, ServerRendered } from "./hydration.ts";

export { isMismatch, solidMismatches } from "./mismatches.ts";

export { renderServer, type ServerRender } from "./server.ts";

export { type Recorded, recordWarnings } from "./warnings.ts";
