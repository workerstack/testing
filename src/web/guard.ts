import type { ConsoleMessage } from "@playwright/test";

// What a page says while a test drives it, and which of that fails the test. A page error or a
// console error fails by default; a test widens that with `fail` and narrows it with `ignore`,
// and every ignore says why, so a silenced error is a decision someone wrote down.

/** `pageerror` for an uncaught exception, or the console method the page called. */
export type GuardKind = "pageerror" | ReturnType<ConsoleMessage["type"]>;

/** Text to look for: a string matches as a substring. A match without `kind` matches every kind. */
export type GuardMatch = {
  text: string | RegExp;
  kind?: GuardKind;
};

/** A match the guard lets through, and why the app may say it. */
export type GuardIgnore = GuardMatch & {
  reason: string;
};

export type GuardOptions = {
  /** More to fail on, on top of every page error and console error. */
  fail?: readonly GuardMatch[];
  /** What to let through; an ignore wins over a `fail` match. */
  ignore?: readonly GuardIgnore[];
};

/** One thing the page said, and the path it was on. */
export type PageEvent = {
  kind: GuardKind;
  text: string;
  path: string;
};

const FAILS_BY_DEFAULT: ReadonlySet<GuardKind> = /* @__PURE__ */ new Set<GuardKind>(["error", "pageerror"]);

const pattern = (text: string | RegExp): string => (typeof text === "string" ? JSON.stringify(text) : String(text));

// `search` reads no `lastIndex`, so a global RegExp matches the same way on every event.
const matches = (match: GuardMatch, event: PageEvent): boolean =>
  (match.kind === undefined || match.kind === event.kind) &&
  (typeof match.text === "string" ? event.text.includes(match.text) : event.text.search(match.text) !== -1);

/** The options as given, once every ignore has a reason; otherwise the error names the one without. */
export function checkGuard(options: GuardOptions): GuardOptions {
  const silent = options.ignore?.find((ignore) => ignore.reason.trim() === "");

  if (silent !== undefined)
    throw new Error(`guard: ignore ${pattern(silent.text)} has no reason; say why the app may log it`);

  return options;
}

/** The events that fail the test, in the order the page said them. */
export function breaches(events: readonly PageEvent[], options: GuardOptions): PageEvent[] {
  const fail = options.fail ?? [];
  const ignore = options.ignore ?? [];

  return events.filter(
    (event) =>
      (FAILS_BY_DEFAULT.has(event.kind) || fail.some((match) => matches(match, event))) &&
      !ignore.some((match) => matches(match, event)),
  );
}

/** One failure line: what was said, on which page, by which test (`where` is its file and line). */
export function breachLine(event: PageEvent, where: string): string {
  const kind = event.kind === "pageerror" ? "pageerror" : `console.${event.kind}`;

  return `guard: ${kind} at ${event.path}: ${JSON.stringify(event.text)} (${where})`;
}
