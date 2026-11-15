import type { GuardMatch } from "../guard.ts";

/*
 * What Solid 2's client runtime says when hydration and the server HTML disagree. Development
 * builds log each of these; a production build only throws the first.
 */
const MISMATCH =
  /Hydration (?:Mismatch\.|key miss|tag mismatch|structure mismatch|completed with \d+ unclaimed)|Failed attempt to create new DOM elements during hydration/;

/** Whether a log line or an error message is one of Solid's hydration mismatches. */
export const isMismatch = (text: string): boolean => MISMATCH.test(text);

/** Solid's mismatch messages, for a page guard to fail on: `test.use({ guard: { fail: solidMismatches } })`. */
export const solidMismatches: readonly GuardMatch[] = [{ text: MISMATCH }];
