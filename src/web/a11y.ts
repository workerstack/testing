import type { AxeBuilder } from "@axe-core/playwright";
import type { Page } from "@playwright/test";

// An accessibility scan of the page as the test left it, at the moment the test asks. The scan
// holds the page to WCAG 2.2 AA; a test narrows it with `include`, and every part it leaves out
// (an `exclude`, a `disable`) says why. axe loads on the first scan, so a consumer that never
// scans needs no axe installed.

/** The axe tags for WCAG 2.2 level AA, which take in every level-A and AA rule before it. */
export const WCAG_22_AA: readonly string[] = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** Elements the scan skips, and why they may fail. */
export type A11yExclude = {
  selector: string;
  reason: string;
};

/** An axe rule the scan skips, by id, and why the page may break it. */
export type A11yDisable = {
  rule: string;
  reason: string;
};

export type A11yOptions = {
  /** A selector the scan is limited to; default the whole page. */
  include?: string;
  exclude?: readonly A11yExclude[];
  disable?: readonly A11yDisable[];
};

export type A11y = {
  /** Scan the page now; fail with one line per violated element. */
  check(options?: A11yOptions): Promise<void>;
};

type Results = Awaited<ReturnType<AxeBuilder["analyze"]>>;

type Target = Results["violations"][number]["nodes"][number]["target"];

// An element inside frames and shadow roots: frames joined by `>>>`, shadow hosts by a space.
const targetText = (target: Target): string =>
  target.map((part) => (typeof part === "string" ? part : part.join(" "))).join(" >>> ");

function requireReasons(options: Required<Pick<A11yOptions, "exclude" | "disable">>): void {
  const silent = [
    ...options.exclude.map((exclude) => ({ kind: "exclude", name: exclude.selector, reason: exclude.reason })),
    ...options.disable.map((disable) => ({ kind: "disable", name: disable.rule, reason: disable.reason })),
  ].find((part) => part.reason.trim() === "");

  if (silent !== undefined)
    throw new Error(`a11y: ${silent.kind} ${JSON.stringify(silent.name)} has no reason; say why it may fail`);
}

/** The scan for one page; `builder` makes the axe builder, and `defaults` come before each call's options. */
export function createA11y({
  builder,
  defaults,
  page,
}: {
  builder: (page: Page) => Promise<AxeBuilder>;
  defaults: A11yOptions;
  page: Page;
}): A11y {
  return {
    async check(options = {}) {
      const exclude = [...(defaults.exclude ?? []), ...(options.exclude ?? [])];
      const disable = [...(defaults.disable ?? []), ...(options.disable ?? [])];
      const include = options.include ?? defaults.include;
      requireReasons({ disable, exclude });
      const scan = (await builder(page)).withTags([...WCAG_22_AA]);

      if (include !== undefined) scan.include(include);

      for (const part of exclude) scan.exclude(part.selector);

      if (disable.length > 0) scan.disableRules(disable.map((part) => part.rule));
      const { violations } = await scan.analyze();

      const lines = violations.flatMap((violation) =>
        violation.nodes.map((node) => `a11y: ${violation.id} at ${targetText(node.target)}: ${violation.help}`),
      );

      if (lines.length > 0) throw new Error(lines.join("\n"));
    },
  };
}

const MISSING: ReadonlySet<string> = /* @__PURE__ */ new Set(["ERR_MODULE_NOT_FOUND", "MODULE_NOT_FOUND"]);

/** The axe builder class from the optional peer; a missing peer fails with what to install. */
export async function loadAxe(
  load: () => Promise<{ AxeBuilder: typeof AxeBuilder }> = () => import("@axe-core/playwright"),
): Promise<typeof AxeBuilder> {
  try {
    return (await load()).AxeBuilder;
  } catch (error) {
    const code = (error as { code?: unknown }).code;

    if (typeof code !== "string" || !MISSING.has(code) || !String(error).includes("@axe-core/playwright")) throw error;
    throw new Error("a11y: needs @axe-core/playwright; run npm install -D @axe-core/playwright", { cause: error });
  }
}
