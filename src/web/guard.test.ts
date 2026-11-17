import { describe, expect, it } from "vitest";

import { breaches, breachLine, checkGuard, type PageEvent } from "./guard.ts";

const event = (kind: PageEvent["kind"], text: string): PageEvent => ({ kind, path: "/home.html", text });

const EVENTS: readonly PageEvent[] = [
  event("log", "started"),
  event("warning", "deprecated api"),
  event("error", "boom"),
  event("pageerror", "x is not defined"),
];

describe("breaches", () => {
  it("fails console errors and page errors by default, and lets logs and warnings pass", () => {
    expect(breaches(EVENTS, {}).map((found) => found.text)).toEqual(["boom", "x is not defined"]);
  });

  it("fails any kind a `fail` match names", () => {
    const found = breaches(EVENTS, { fail: [{ kind: "warning", text: "deprecated" }] });
    expect(found.map((one) => one.text)).toEqual(["deprecated api", "boom", "x is not defined"]);
  });

  it("fails a `fail` match without a kind on every kind its text matches", () => {
    expect(breaches(EVENTS, { fail: [{ text: /^start/ }] }).map((one) => one.kind)).toEqual([
      "log",
      "error",
      "pageerror",
    ]);
  });

  it("drops what an ignore matches, by substring or by RegExp", () => {
    const ignore = [
      { reason: "a known third-party widget", text: "oom" },
      { reason: "the legacy bundle", text: /not defined$/ },
    ];

    expect(breaches(EVENTS, { ignore })).toEqual([]);
  });

  it("drops only the kind an ignore names", () => {
    const found = breaches([event("error", "boom"), event("pageerror", "boom")], {
      ignore: [{ kind: "error", reason: "logged on purpose", text: "boom" }],
    });

    expect(found).toEqual([event("pageerror", "boom")]);
  });

  it("lets an ignore win over a `fail` match", () => {
    const found = breaches(EVENTS, {
      fail: [{ kind: "warning", text: "deprecated" }],
      ignore: [{ reason: "the upgrade lands next release", text: "deprecated" }],
    });

    expect(found.map((one) => one.text)).toEqual(["boom", "x is not defined"]);
  });

  it("matches a global RegExp the same way every time", () => {
    const twice = [event("error", "boom"), event("error", "boom")];
    expect(breaches(twice, { ignore: [{ reason: "logged on purpose", text: /boom/g }] })).toEqual([]);
  });
});

describe("checkGuard", () => {
  it("refuses an ignore with a blank reason, naming its pattern", () => {
    expect(() => checkGuard({ ignore: [{ reason: " ", text: /ResizeObserver loop/ }] })).toThrow(
      "guard: ignore /ResizeObserver loop/ has no reason; say why the app may log it",
    );
    expect(() => checkGuard({ ignore: [{ reason: "", text: "boom" }] })).toThrow(
      'guard: ignore "boom" has no reason; say why the app may log it',
    );
  });

  it("accepts options whose every ignore says why", () => {
    const options = { ignore: [{ reason: "logged on purpose", text: "boom" }] };
    expect(checkGuard(options)).toBe(options);
    expect(checkGuard({})).toEqual({});
  });
});

describe("breachLine", () => {
  it("names the kind, the page, the text and the test", () => {
    expect(breachLine(event("error", "boom"), "guard.spec.ts:7")).toBe(
      'guard: console.error at /home.html: "boom" (guard.spec.ts:7)',
    );
    expect(breachLine(event("pageerror", "x is not defined"), "guard.spec.ts:9")).toBe(
      'guard: pageerror at /home.html: "x is not defined" (guard.spec.ts:9)',
    );
  });
});
