import { describe, expect, it } from "vitest"
import { stringFor } from "./string.ts"
import type { At, Context } from "./types.ts"
import { Unconstructible } from "./unconstructible.ts"
import type { JsonSchema } from "../../spec/types.ts"

const at = (fields: Partial<Context> = {}, distinct = false): At => ({
	ctx: {
		defs: {},
		depth: 0,
		distinct: new Set(),
		examples: true,
		index: 2,
		nonce: "n0",
		optional: "all",
		rand: () => 0.5,
		refs: [],
		variant: "baseline",
		...fields,
	},
	distinct,
	pointer: "/s",
})

const refused = (schema: JsonSchema, ctx: At = at()): string => {
	try {
		stringFor(schema, ctx)
	} catch (error) {
		if (error instanceof Unconstructible) return `${error.pointer} ${error.reason}`
		throw error
	}
	return "made"
}

describe("stringFor", () => {
	it("refuses bounds that cross", () => {
		expect(refused({ maxLength: 1, minLength: 2 })).toBe("/s minLength 2 exceeds maxLength 1")
	})

	it("makes a known format, lengthening an address, a URL or a host to the minimum", () => {
		expect(stringFor({ format: "DATE" }, at())).toBe("2024-03-03")
		expect(stringFor({ format: "email", minLength: 34 }, at())).toBe("testing-baseline-2xxx@example.test")
		expect(stringFor({ format: "idn-email", minLength: 32 }, at())).toBe("testing-baseline-2x@example.test")
		expect(stringFor({ format: "uri", minLength: 33 }, at())).toBe("https://example.test/baseline-2xx")
		expect(stringFor({ format: "url", minLength: 33 }, at())).toBe("https://example.test/baseline-2xx")
		expect(stringFor({ format: "iri", minLength: 33 }, at())).toBe("https://example.test/baseline-2xx")
		expect(stringFor({ format: "uri", minLength: 3 }, at())).toBe("https://example.test/baseline-2")
		expect(stringFor({ format: "hostname", minLength: 22 }, at())).toBe("xxxhost-2.example.test")
		expect(stringFor({ format: "idn-hostname", minLength: 21 }, at())).toBe("xxhost-2.example.test")
	})

	it("refuses a format that cannot fit the length or match the pattern", () => {
		expect(refused({ format: "date", minLength: 20 })).toBe("/s a date cannot fit length 20–Infinity")
		expect(refused({ format: "date", maxLength: 5 })).toBe("/s a date cannot fit length 0–5")
		expect(refused({ format: "hostname", minLength: 100 })).toBe("/s a hostname cannot fit length 100–Infinity")
		expect(refused({ format: "date", pattern: "^x" })).toBe("/s a date cannot match pattern ^x")
		expect(stringFor({ format: "date", pattern: "^2024" }, at())).toBe("2024-03-03")
	})

	it("searches a pattern for an unknown format, and refuses one nothing matches", () => {
		expect(stringFor({ format: "color", pattern: "^#[0-9]{6}$" }, at())).toBe("#000000")
		expect(refused({ pattern: "^[0-9]{3}$", maxLength: 2 })).toBe("/s no string found for pattern ^[0-9]{3}$")
	})

	it("makes plain text, a run of B at the boundary", () => {
		expect(stringFor({}, at())).toBe("Quarterly Report 2")
		expect(stringFor({ maxLength: 4 }, at({ variant: "boundary" }))).toBe("BBBB")
		expect(stringFor({}, at({ variant: "boundary" }))).toBe("B".repeat(512))
		expect(stringFor({ maxLength: 0 }, at({ variant: "boundary" }))).toBe("")
	})

	it("shortens text keeping its distinguishing tail, or cuts it when the tail is too long", () => {
		expect(stringFor({ maxLength: 8 }, at())).toBe("Quarte 2")
		expect(stringFor({ maxLength: 8 }, at({}, true))).toBe("Quart n0")
		expect(stringFor({ maxLength: 2 }, at())).toBe("Qu")
	})

	it("pads text to the minimum", () => {
		expect(stringFor({ minLength: 20 }, at())).toBe("Quarterly Report 2xx")
	})
})

describe("stringFor and the schema's examples", () => {
	it("takes a documented example when the pattern refuses plain text, cycling through them by index", () => {
		const zone = {
			examples: ["Europe/Zagreb", "Asia/Tokyo"],
			maxLength: 64,
			pattern: "^[A-Za-z_]+(?:/[A-Za-z_]+){0,2}$",
		}
		expect(stringFor(zone, at({ index: 0 }))).toBe("Europe/Zagreb")
		expect(stringFor(zone, at({ index: 1 }))).toBe("Asia/Tokyo")
		expect(stringFor(zone, at({ index: 2, variant: "unicode" }))).toBe("Europe/Zagreb")
	})

	it("takes only an example that meets every keyword, and searches the pattern when none does", () => {
		const schema = { examples: ["ab", 3, "toolongvalue", "xy"], maxLength: 4, pattern: "^[a-z]+$" }
		expect(stringFor(schema, at({ index: 0 }))).toBe("ab")
		expect(stringFor(schema, at({ index: 1 }))).toBe("xy")
		expect(stringFor({ examples: ["AB", 1], pattern: "^[a-z]+$" }, at())).toBe("aa")
		expect(stringFor({ examples: "ab", pattern: "^[a-z]+$" }, at())).toBe("aa")
	})

	it("takes an example over text a pattern or unknown format would admit, and text where nothing restricts it", () => {
		expect(stringFor({ examples: ["HR"], format: "iso-3166-alpha-2" }, at())).toBe("HR")
		expect(stringFor({ examples: ["Europe/Zagreb"], pattern: "^[A-Za-z/]+$" }, at({ variant: "boundary" }))).toBe(
			"Europe/Zagreb",
		)
		expect(stringFor({ examples: ["Acme"] }, at())).toBe("Quarterly Report 2")
		expect(stringFor({ examples: ["Acme"], format: "date" }, at())).toBe("2024-03-03")
	})

	it("leaves the examples alone for a value that must be distinct, or when told to", () => {
		const schema = { examples: ["Europe/Zagreb"], pattern: "^[A-Za-z_]+(?:/[A-Za-z_]+)?$" }
		expect(stringFor(schema, at({}, true))).not.toBe("Europe/Zagreb")
		expect(stringFor(schema, at({ examples: false }))).not.toBe("Europe/Zagreb")
	})
})
