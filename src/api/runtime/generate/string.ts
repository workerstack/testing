/** A string value within the schema's length, format and pattern. */

import { codePointCount, sliceCodePoints } from "../payloads.ts"
import { formatted } from "./format.ts"
import { matching } from "./pattern.ts"
import { admits, type StringConstraints, stringConstraints } from "./string-constraints.ts"
import { text } from "./text.ts"
import type { JsonSchema } from "../../spec/types.ts"
import type { At } from "./types.ts"
import { Unconstructible } from "./unconstructible.ts"

function padFormatted(format: string, value: string, min: number): string {
	const short = min - codePointCount(value)
	if (short <= 0) return value
	if (format === "email" || format === "idn-email") return value.replace("@", `${"x".repeat(short)}@`)
	if (format.startsWith("uri") || format.startsWith("iri") || format === "url") return `${value}${"x".repeat(short)}`
	if (format === "hostname" || format === "idn-hostname") return `${"x".repeat(Math.min(short, 60))}${value}`
	return value
}

/* A short address or URL can be lengthened without leaving its format; a date cannot. */
function inFormat(format: string, constraints: StringConstraints, at: At): string | undefined {
	const unpadded = formatted(format, at.ctx, at.distinct)
	if (unpadded === undefined) return undefined
	const { minLength: min, maxLength: max, patterns } = constraints
	const known = padFormatted(format, unpadded, min)
	if (codePointCount(known) > max || codePointCount(known) < min) {
		throw new Unconstructible(`a ${format} cannot fit length ${min}–${max}`, at.pointer)
	}
	if (!admits(constraints, known)) {
		throw new Unconstructible(`a ${format} cannot match pattern ${patterns.join(" and ")}`, at.pointer)
	}
	return known
}

/* The first string some pattern's search finds that every pattern and both lengths admit. */
function searched(constraints: StringConstraints, at: At): string | undefined {
	const length = { max: constraints.maxLength, min: constraints.minLength }
	for (const pattern of constraints.patterns) {
		const candidate = matching(pattern, length, at)
		if (candidate !== undefined && admits(constraints, candidate)) return candidate
	}
	return undefined
}

/*
 * The document's own examples that meet every keyword, taken in turn by index: a pattern is often
 * looser than the set the API takes (`AA` matches a time zone's pattern and names no zone), and an
 * example is a value the API is documented to take. A value that must be distinct across runs cannot
 * repeat one, so it is searched as before.
 */
function documented(constraints: StringConstraints, at: At): string | undefined {
	if (!at.ctx.examples || at.distinct) return undefined
	const valid = (constraints.examples ?? []).filter(
		(value): value is string => typeof value === "string" && admits(constraints, value),
	)
	return valid.length === 0 ? undefined : valid[at.ctx.index % valid.length]
}

/** The variant's text, cut to `max` or padded to `min`. */
function plain(min: number, max: number, at: At): string {
	const { ctx, distinct } = at
	let value = ctx.variant === "boundary" ? "B".repeat(Math.max(1, Math.min(max, 512))) : text(ctx, distinct)
	if (codePointCount(value) > max) {
		/* Keep the distinguishing tail when shortening: the index and nonce are what make it unique. */
		const tail = distinct && ctx.nonce !== undefined ? ` ${ctx.nonce}` : ` ${ctx.index}`
		value =
			codePointCount(tail) < max
				? sliceCodePoints(value, max - codePointCount(tail)) + tail
				: sliceCodePoints(value, max)
	}
	if (codePointCount(value) < min) value = value + "x".repeat(min - codePointCount(value))
	return value
}

export function stringFor(schema: JsonSchema, at: At): string {
	const constraints = stringConstraints(schema)
	const { minLength: min, maxLength: max, patterns } = constraints
	if (min > max) throw new Unconstructible(`minLength ${min} exceeds maxLength ${max}`, at.pointer)
	const format = typeof schema.format === "string" ? schema.format.toLowerCase() : undefined

	const known = format === undefined ? undefined : inFormat(format, constraints, at)
	if (known !== undefined) return known
	/* A pattern, or a format it cannot make, restricts the value: an example meets it where text that
	 * merely matches may not. Otherwise realistic text: a guard on every string changes nothing. */
	const restricted = format !== undefined || patterns.length > 0
	const example = restricted ? documented(constraints, at) : undefined
	if (example !== undefined) return example
	const realistic = plain(min, max, at)
	if (admits(constraints, realistic)) return realistic
	const candidate = searched(constraints, at)
	if (candidate === undefined) {
		throw new Unconstructible(`no string found for pattern ${patterns.join(" and ")}`, at.pointer)
	}
	return candidate
}
