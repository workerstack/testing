import { describe, expect, it } from "vitest";

import { tag, tags, text } from "./html.ts";

const PAGE = [
  '<DIV data-slot="root" class="a &amp; b">',
  '<button data-slot="button" type="button" disabled title="1 &lt; 2 &gt; 0" data-x=\'it&#x27;s\'>Save &amp;&nbsp;close</button>',
  '<input data-slot="field" class="[&>input]:px-2" value=bare>',
  '<span data-slot="button">two</span>',
  "</DIV>",
].join("");

describe("tags", () => {
  it("reads every element in order, names lowercased and attributes decoded", () => {
    const found = tags(PAGE);
    expect(found.map((one) => one.name)).toEqual(["div", "button", "input", "span"]);
    expect(found[0]?.attrs).toEqual({ class: "a & b", "data-slot": "root" });
    expect(found[1]?.attrs).toEqual({
      "data-slot": "button",
      "data-x": "it's",
      disabled: "",
      title: "1 < 2 > 0",
      type: "button",
    });
    expect(found[2]?.attrs).toEqual({ class: "[&>input]:px-2", "data-slot": "field", value: "bare" });
  });

  it("gives each element its decoded text", () => {
    expect(tags(PAGE, "button")[0]?.text).toBe("Save & close");
    expect(tags(PAGE, "div")[0]?.text).toBe("Save & closetwo");
    expect(tags(PAGE, "input")[0]?.text).toBe("");
  });

  it("keeps the elements a tag name or every given attribute matches", () => {
    expect(tags(PAGE, "BUTTON").map((one) => one.name)).toEqual(["button"]);
    expect(tags(PAGE, { "data-slot": "button" }).map((one) => one.name)).toEqual(["button", "span"]);
    expect(tags(PAGE, { "data-slot": "button", type: "button" }).map((one) => one.name)).toEqual(["button"]);
    expect(tags(PAGE, { disabled: "" }).map((one) => one.name)).toEqual(["button"]);
    expect(tags(PAGE, "table")).toEqual([]);
  });

  it("keeps a component's cells rendered without their table, and reads a template's content", () => {
    expect(tags("<td>cell</td><template><b>in</b></template>").map((one) => one.name)).toEqual(["td", "template", "b"]);
  });
});

describe("tag", () => {
  it("gives the one element that matches", () => {
    expect(tag(PAGE, "input").attrs["value"]).toBe("bare");
    expect(tag(PAGE, { "data-slot": "root" }).name).toBe("div");
  });

  it("throws with the match, the count and the HTML when there is none or more than one", () => {
    expect(() => tag(PAGE, { "data-slot": "button" })).toThrow(
      `tag: expected one <* data-slot="button">, found 2 in: ${PAGE}`,
    );
    expect(() => tag(PAGE, "table")).toThrow(`tag: expected one <table>, found 0 in: ${PAGE}`);
    expect(() => tag("<p></p>", { "data-a": "1", "data-b": 'say "hi"' })).toThrow(
      'tag: expected one <* data-a="1" data-b="say &quot;hi&quot;">, found 0 in: <p></p>',
    );
  });
});

describe("text", () => {
  it("is the decoded text of the whole HTML, without tags", () => {
    expect(text(PAGE)).toBe("Save & closetwo");
    expect(text("a <!-- note --> b")).toBe("a  b");
    expect(text("")).toBe("");
  });
});
