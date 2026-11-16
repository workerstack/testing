import { renderServer, tag } from "@workerstack/testing/web/solid";
import { describe, expect, it } from "vitest";

import { Labeled } from "./labeled.fixture.tsx";

describe("a packed consumer's server test", () => {
  it("renders a component that reads Solid's owner", () => {
    const { html, warnings } = renderServer(() => <Labeled />);
    expect(warnings).toEqual([]);
    expect(tag(html, { "data-slot": "label" }).attrs["for"]).toBe(tag(html, { "data-slot": "name" }).attrs["id"]);
  });
});
