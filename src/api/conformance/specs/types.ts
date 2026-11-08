/** One hostile spec fixture: a document and what the API tester should find in it. */
export interface SpecFixture {
	name: string
	why: string
	doc: Record<string, unknown>
	/** Operations the API tester should find. Undefined means "no expectation, just do not crash". */
	expectOperations?: number
	expectEntities?: number
}
