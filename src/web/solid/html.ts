import { type DefaultTreeAdapterMap, parseFragment } from "parse5"

/*
 * Server HTML read the way a browser reads it: parse5 is the HTML standard's parser, so every
 * entity is decoded and a `>` inside an attribute value stays in the value. It parses as a
 * template's content does, so a component that renders only a table row keeps its cells.
 */

type Node = DefaultTreeAdapterMap["node"]
type Element = DefaultTreeAdapterMap["element"]

/** One element: its lowercased name, its decoded attributes (a bare one is ""), and its text. */
export interface Tag {
	name: string
	attrs: Record<string, string>
	text: string
}

/** A tag name, or attributes that must all be present with these values. */
export type TagMatch = string | Readonly<Record<string, string>>

const isElement = (node: Node): node is Element => "tagName" in node

/* A template's children live in its content fragment, as in the DOM. */
function childrenOf(node: Node): Node[] {
	if (isElement(node) && node.tagName === "template")
		return (node as DefaultTreeAdapterMap["template"]).content.childNodes
	return "childNodes" in node ? node.childNodes : []
}

function textOf(node: Node): string {
	if (node.nodeName === "#text") return (node as DefaultTreeAdapterMap["textNode"]).value
	return childrenOf(node).map(textOf).join("")
}

function elementsUnder(node: Node): Element[] {
	return childrenOf(node).flatMap((child) =>
		isElement(child) ? [child, ...elementsUnder(child)] : elementsUnder(child),
	)
}

const toTag = (element: Element): Tag => ({
	attrs: Object.fromEntries(element.attrs.map((attr) => [attr.name, attr.value])),
	name: element.tagName,
	text: textOf(element),
})

function matches(found: Tag, match: TagMatch): boolean {
	if (typeof match === "string") return found.name === match.toLowerCase()
	return Object.entries(match).every(([name, value]) => found.attrs[name] === value)
}

/** Every element in the HTML, in document order; with `match`, only those it matches. */
export function tags(html: string, match?: TagMatch): Tag[] {
	const found = elementsUnder(parseFragment(html)).map(toTag)
	return match === undefined ? found : found.filter((one) => matches(one, match))
}

const quoted = (value: string): string => `"${value.replaceAll('"', "&quot;")}"`

/* The match as a tag a reader recognizes: `<button>`, or `<* data-slot="button">`. */
function describe(match: TagMatch): string {
	if (typeof match === "string") return `<${match.toLowerCase()}>`
	const attrs = Object.entries(match).map(([name, value]) => `${name}=${quoted(value)}`)
	return `<* ${attrs.join(" ")}>`
}

/** The one element the match finds; throws, naming the count and the HTML, on none or several. */
export function tag(html: string, match: TagMatch): Tag {
	const found = tags(html, match)
	const [only] = found
	if (only === undefined || found.length > 1) {
		throw new Error(`tag: expected one ${describe(match)}, found ${found.length} in: ${html}`)
	}
	return only
}

/** The decoded text of the HTML, without its tags and comments. */
export function text(html: string): string {
	return textOf(parseFragment(html))
}
