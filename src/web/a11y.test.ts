import type { AxeBuilder } from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { describe, expect, it } from "vitest";

import { createA11y, loadAxe, WCAG_22_AA, type A11yOptions } from "./a11y.ts";

type Results = Awaited<ReturnType<AxeBuilder["analyze"]>>;

type Violation = Results["violations"][number];

const PAGE = {} as Page;

// A builder that records what the scan was told, and answers with the given violations.
function fakeBuilder(violations: readonly Partial<Violation>[] = []): {
  calls: Array<[string, unknown]>;
  builder: (page: Page) => Promise<AxeBuilder>;
  pages: Page[];
} {
  const calls: Array<[string, unknown]> = [];
  const pages: Page[] = [];

  const record = (name: string) =>
    function (this: unknown, value: unknown) {
      calls.push([name, value]);

      return this;
    };

  const fake = {
    analyze: async () => ({ violations }),
    disableRules: record("disableRules"),
    exclude: record("exclude"),
    include: record("include"),
    withTags: record("withTags"),
  };

  return {
    builder: async (page) => {
      pages.push(page);

      return fake as unknown as AxeBuilder;
    },
    calls,
    pages,
  };
}

const violation = (id: string, help: string, targets: Violation["nodes"][number]["target"][]): Partial<Violation> =>
  ({ help, id, nodes: targets.map((target) => ({ target })) }) as Partial<Violation>;

describe("a11y.check", () => {
  it("scans the page for WCAG 2.2 AA and passes when nothing is violated", async () => {
    const { builder, calls, pages } = fakeBuilder();
    await createA11y({ builder, defaults: {}, page: PAGE }).check();
    expect(pages).toEqual([PAGE]);
    expect(calls).toEqual([["withTags", ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]]]);
    expect(WCAG_22_AA).toEqual(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]);
  });

  it("tells the scan what to include, exclude and skip, the defaults first", async () => {
    const { builder, calls } = fakeBuilder();

    const defaults: A11yOptions = {
      disable: [{ reason: "a fragment, not a page", rule: "region" }],
      exclude: [{ reason: "inert focus sentinel", selector: "[data-focus-guard]" }],
      include: "body",
    };

    await createA11y({ builder, defaults, page: PAGE }).check({
      disable: [{ reason: "the brand palette, tracked in DS-12", rule: "color-contrast" }],
      exclude: [{ reason: "third-party embed", selector: "iframe.map" }],
      include: "main",
    });
    expect(calls.slice(1)).toEqual([
      ["include", "main"],
      ["exclude", "[data-focus-guard]"],
      ["exclude", "iframe.map"],
      ["disableRules", ["region", "color-contrast"]],
    ]);
  });

  it("fails with one line per violated node, naming the rule, the node and the help", async () => {
    const { builder } = fakeBuilder([
      violation("image-alt", "Images must have alternative text", [["img.hero"], ["img.logo"]]),
      violation("button-name", "Buttons must have discernible text", [["iframe#pay", ["x-card", "button"]]]),
    ]);

    await expect(createA11y({ builder, defaults: {}, page: PAGE }).check()).rejects.toThrow(
      [
        "a11y: image-alt at img.hero: Images must have alternative text",
        "a11y: image-alt at img.logo: Images must have alternative text",
        "a11y: button-name at iframe#pay >>> x-card button: Buttons must have discernible text",
      ].join("\n"),
    );
  });

  it("refuses an exclude or a disable with a blank reason, before it scans", async () => {
    const { builder, pages } = fakeBuilder();
    const a11y = createA11y({ builder, defaults: {}, page: PAGE });
    await expect(a11y.check({ exclude: [{ reason: " ", selector: "[data-focus-guard]" }] })).rejects.toThrow(
      'a11y: exclude "[data-focus-guard]" has no reason; say why it may fail',
    );
    await expect(a11y.check({ disable: [{ reason: "", rule: "region" }] })).rejects.toThrow(
      'a11y: disable "region" has no reason; say why it may fail',
    );
    expect(pages).toEqual([]);
  });
});

describe("loadAxe", () => {
  it("loads the axe builder the package's peer provides", async () => {
    expect((await loadAxe()).name).toBe("AxeBuilder");
  });

  it("says what to install when the peer is missing, by either module system's code", async () => {
    for (const code of ["ERR_MODULE_NOT_FOUND", "MODULE_NOT_FOUND"]) {
      const missing = Object.assign(new Error("Cannot find package '@axe-core/playwright'"), { code });
      await expect(loadAxe(async () => Promise.reject(missing))).rejects.toThrow(
        "a11y: needs @axe-core/playwright; run npm install -D @axe-core/playwright",
      );
    }
  });

  it("lets any other load failure through as it is", async () => {
    const broken = new SyntaxError("Unexpected token");
    await expect(loadAxe(async () => Promise.reject(broken))).rejects.toBe(broken);
  });
});
