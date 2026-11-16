import { type JSX, renderToString } from "@solidjs/web";

import { recordWarnings } from "./warnings.ts";

/** The HTML a server render sent, and what Solid and the app warned while rendering it. */
export type ServerRender = {
  html: string;
  /** Solid warns once per kind of warning per process, so a file checks a warning in its first test. */
  warnings: string[];
};

/** Renders `code` to HTML as an SSR app's request handler does, recording its warnings. */
export function renderServer(code: () => JSX.Element): ServerRender {
  const { result, warnings } = recordWarnings(() => renderToString(code));

  return { html: result, warnings };
}
